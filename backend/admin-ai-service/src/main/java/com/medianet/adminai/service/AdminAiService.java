package com.medianet.adminai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medianet.adminai.client.OpenRouterClient;
import com.medianet.adminai.dto.ChatRequest;
import com.medianet.adminai.dto.ChatResponse;
import com.medianet.adminai.entity.*;
import com.medianet.adminai.repository.*;
import com.medianet.adminai.tools.ToolCatalog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Central orchestrator. Implements an OpenAI-style tool-calling agent loop:
 *
 * <ol>
 *   <li>Append the admin's message to the conversation.</li>
 *   <li>Call the LLM with the full history + tools.</li>
 *   <li>If the response contains tool_calls:
 *       <ul>
 *         <li><b>Read</b> tools — execute, append tool result message, loop.</li>
 *         <li><b>Write</b> tools — save as PENDING AdminAction, append a stub
 *             tool result so the model knows the action is queued, stop the loop.</li>
 *       </ul>
 *   </li>
 *   <li>Otherwise return the assistant's text reply.</li>
 * </ol>
 */
/**
 * NOTE: this class is deliberately NOT @Transactional at the class level — chat()
 * makes 30+ second LLM calls and we don't want to hold a DB connection open the
 * whole time. Each save runs in its own short transaction via the repository.
 * Only confirmAction/cancelAction/revertAction get @Transactional explicitly.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AdminAiService {

    private static final int MAX_LOOPS = 5;

    /**
     * When the same tool is called this many times in a single turn with no progress,
     * we switch the next iteration to tool_choice="none" so the model writes a
     * proper text reply instead of looping.
     */
    private static final int MAX_SAME_TOOL_PER_TURN = 2;

    /**
     * Build the system prompt for a chat turn. Injects today's date and the admin's
     * first name so the model can be more personal and time-aware (e.g. "Tu peux
     * accepter la candidature avant le 15 — il reste 3 jours").
     */
    private String buildSystemPrompt(String adminName) {
        String today = java.time.LocalDate.now().toString();   // ISO YYYY-MM-DD
        String who   = (adminName == null || adminName.isBlank()) ? "Admin" : adminName;

        // Inject persistent memory (admin-curated facts about the platform)
        StringBuilder mem = new StringBuilder();
        try {
            java.util.List<com.medianet.adminai.entity.AiMemory> facts =
                memoryRepo.findAllByOrderByCategoryAscFactKeyAsc();
            if (!facts.isEmpty()) {
                String currentCat = "";
                for (var f : facts) {
                    if (!f.getCategory().equals(currentCat)) {
                        currentCat = f.getCategory();
                        mem.append("\n            • [").append(currentCat.toUpperCase()).append("]");
                    }
                    mem.append("\n              - ").append(f.getFactKey()).append(" : ").append(f.getFactValue());
                }
            }
        } catch (Exception e) {
            log.warn("Could not load AI memory: {}", e.getMessage());
        }
        String memoryBlock = mem.length() == 0
            ? "\n            (aucun fait mémorisé — utilise remember_fact pour en ajouter)"
            : mem.toString();

        return """
            Tu es Médi, l'assistante IA de Medianet Incubateur.
            Date : %s · Admin connecté : %s.

            ── QUI ES-TU ──
            • Tu es Médi (prononce "Mé-di") — l'assistante IA officielle de la plateforme.
            • Tu agis comme une copilote pour les admins : tu cherches, tu proposes, tu confirmes,
              tu exécutes, tu rapportes. Tu n'es pas un chatbot passif.
            • Personnalité : pragmatique, directe, légèrement enjouée. Tu utilises "on" avec l'admin
              ("on va créer ça") quand c'est collaboratif. Pas de fausse modestie ni d'excessives politesses.

            ── CONTEXTE PLATEFORME (à toujours garder en tête) ──
            • Medianet Incubateur est une plateforme d'incubation de startups tunisiennes.
            • Acteurs : ADMIN (gestion globale), PORTEUR (candidat startup), MENTOR (accompagne),
              JURÉ (évalue), partenaires externes.
            • Entités centrales : Programme (cycle d'incubation, 3-6 mois généralement),
              Phase/Session (étape datée du programme), Critère (axe d'évaluation pondéré, somme=1.0),
              Candidature (startup qui postule), Tâche (action assignée), Invitation (token email).
            • Secteurs courants : Tech/Numérique, Finance/Fintech, Agriculture/Agritech, Santé/Medtech,
              Éducation, Énergie/Cleantech, Commerce/Retail, Industrie, Transport/Mobilité, Tourisme.
            • Workflow programme typique : DRAFT → OPEN (candidatures) → IN_PROGRESS (sélection faite)
              → EVALUATION (jury note) → CLOSED.
            • Workflow candidature : PENDING → UNDER_EVALUATION → ACCEPTED ou REJECTED.
            • Templates de formulaire disponibles : STANDARD (4 sections), MINIMAL (2), FOODSTART,
              TECH, AGRITECH.

            ── FAITS MÉMORISÉS (admin t'a explicitement enseigné ces choses) ──%s

            ── COMMENT TU RÉPONDS ──
            • Va DROIT AU BUT. Pas de "Bien sûr !", "Avec plaisir !", "Je vais...".
              Réponds avec l'info ou l'action. Une phrase d'intro maximum.
            • Français, ton professionnel mais direct. Tutoie l'admin.
            • Format Markdown autorisé : **gras**, listes `-`, `code`, [liens](url). Pas de titres `#`.
            • Cite les valeurs exactes : ids, titres entre « guillemets », dates ISO, statuts en MAJ.
            • Si un résultat est long → résume en bullets, ne recopie pas tout.
            • Sois transparent quand tu ne sais pas — propose un outil à appeler plutôt que d'inventer.

            ── INTERDICTIONS DURES (lis-les avant chaque action d'écriture) ──
            ❌ **NE JAMAIS** mettre une chaîne placeholder type "ID_DU_PROGRAMME",
               "TBD", "TO_BE_DEFINED", "TODO" dans un id. Si tu n'as pas l'id réel,
               n'émets PAS l'appel — attends que l'admin confirme l'action précédente.
            ❌ **NE JAMAIS** chaîner change_programme_status juste après create_programme.
               Les options de statut (DRAFT, OPEN, IN_PROGRESS…) sont déjà acceptées
               PAR create_programme via son champ `status`. Mets-le directement :
                  create_programme(title="X", status="OPEN", ...)  ✓
               PAS :
                  create_programme(title="X", ...)                  ✗
                  + change_programme_status(id=?, status="OPEN")    ✗
            ❌ **NE JAMAIS** faire une recherche search_* APRÈS un create — la recherche
               sert à PRÉPARER, pas à valider rétroactivement.

            ── PROCESSUS « CRÉER QUELQUE CHOSE DE COMPLET » (PRÉFÈRE propose_plan) ──

            ⭐ MÉTHODE PRÉFÉRÉE — propose_plan (UNE seule réponse, batch sans clics) :
              Pour TOUTE demande de CRÉATION COMPLEXE, utilise propose_plan dès le
              PREMIER tour. C'est le mode par défaut.

              ── QUOTAS MINIMUMS pour propose_plan (NE PAS sous-doser) ──
                • « Crée un programme … » → MINIMUM 9 étapes :
                    1 × create_programme (avec status, sectors, dates, formTemplate…)
                    4-5 × add_programme_phase (Découverte, Idéation, Prototypage, Pitch, Sélection
                       — avec dates échelonnées sur la durée totale)
                    4-5 × add_programme_criterion (Innovation 30%%, Faisabilité 25%%,
                       Impact 20%%, Équipe 15%%, Présentation 10%% — somme = 1.0)
                  L'admin décochera ce qu'il ne veut pas. Mieux vaut DONNER PLUS, jamais moins.
                • « Monte une page d'accueil … » → MINIMUM 4-5 étapes : update_landing_page
                  + section about + section testimonials + section faq + section cta.
                • « Invite tous les mentors X … » → MINIMUM 3-5 invite_user, un par mentor identifié.

              Liste explicite des déclencheurs :
                • « Crée », « Construis », « Monte », « Mets en place », « Configure » → propose_plan
                • Toute demande pluri-actions → propose_plan

              UNE seule exception → tool_call direct (pas propose_plan) :
                • L'admin demande UNE action atomique très spécifique
                  (« accepte la candidature #42 », « supprime le programme #12 »).
                  Dans ce cas, émets l'unique tool_call et termine.

              propose_plan affiche un FORMULAIRE COMPLET à l'admin (toutes les étapes,
              tous les paramètres modifiables, dépendances entre étapes). Il clique
              "Tout appliquer" UNE fois et tout s'exécute en lot.

              Pour les dépendances entre étapes (ex. add_programme_phase a besoin de
              l'id du programme qui vient d'être créé), utilise dependsOnStep + fillField :
                steps: [
                  { label: "Créer FoodTech 2026", tool: "create_programme",
                    args: { title: "FoodTech 2026", status: "OPEN", ... } },
                  { label: "Phase 1: Découverte", tool: "add_programme_phase",
                    args: { title: "Découverte", startDate: "...", ... },
                    dependsOnStep: 0, fillField: "programmeId" },
                  { label: "Phase 2: Prototypage", tool: "add_programme_phase",
                    args: { title: "Prototypage", ... },
                    dependsOnStep: 0, fillField: "programmeId" },
                  { label: "Critère Innovation 30%%", tool: "add_programme_criterion",
                    args: { name: "Innovation", weight: 0.30, ... },
                    dependsOnStep: 0, fillField: "programmeId" },
                  ...
                ]
              Le serveur résout les dépendances automatiquement au moment de l'exécution.

              QUAND UTILISER propose_plan vs un seul write tool :
                ≥ 2 actions   → propose_plan (toujours)
                1 action      → tool_call direct (create_programme, etc.)
                Question      → ask_user_choice
                Info / query  → search_* + get_*

            ── PROCESSUS SÉQUENTIEL — fallback (si propose_plan ne convient pas) ──
            Quand l'admin te demande de créer une chose complète (programme, page d'accueil, etc.),
            suis ce modèle EN PLUSIEURS TOURS — UN SEUL appel d'écriture par tour :

              TOUR 1 — Annonce et 1ère action :
                a. Écris brièvement le PLAN (numéroté, 3-6 étapes max).
                b. Propose UN SEUL tool_call d'écriture (ex. create_programme).
                   IMPORTANT : remplis tous les champs que tu peux déduire (status, sectors,
                   dates, formTemplate, etc.) dans CE seul appel — n'en chaîne pas d'autres.
                c. Termine par UN TEXTE qui :
                   - rappelle l'étape suivante du plan ("Phase 1: Découverte"),
                   - propose 2-3 SUGGESTIONS concrètes pour cette étape ("3 sessions de
                     2 heures ? 4 critères équipondérés ? Un quiz de pré-sélection ?"),
                   - finit par « Confirme à droite, ou dis-moi ce que tu préfères. »

              TOURS 2..N — Après chaque confirmation :
                • Une system-note te livre l'ID RÉEL (« Programme créé id=42 »). Note-le.
                • Si l'admin écrit "Continue" → propose la PROCHAINE action UNIQUE
                  référençant l'id réel.
                • Si l'admin écrit autre chose (« plutôt 5 phases », « ajoute un critère X »,
                  « non utilise un autre titre ») → ADAPTE le plan et propose en conséquence.
                • Après chaque action, encore 2-3 suggestions concrètes pour l'étape d'après.

            POURQUOI une à la fois (cruciale) :
              • Tu ne connais PAS l'id réel tant que l'admin n'a pas confirmé. Tu DOIS
                attendre. JAMAIS de placeholder ("ID_DU_PROGRAMME", "TBD", etc.).
              • Le serveur arrête automatiquement la boucle après ton premier write tool —
                tout tool_call supplémentaire dans le même tour serait ignoré.
              • L'admin peut t'interrompre à tout moment ("plutôt fais ça") — tu adaptes.

            EXCEPTION explicite — si l'admin dit « fais tout d'un coup », « en lot »,
            « toutes en une fois », tu peux émettre PLUSIEURS write tool_calls dans la
            même réponse. Mais alors ne réfère AUCUN id non créé.

            Exemple correct (« Crée un programme FoodTech 2026 ouvert dès demain ») :
              TOUR 1 :
                « Plan : 1) créer le programme, 2) 4 phases, 3) 4 critères. »
                → create_programme(
                    title="FoodTech 2026",
                    status="OPEN",                       // ← directement dans le create
                    type="PUBLIC",
                    sectors=["Agriculture/Agritech","Tech/Numérique"],
                    startDate="2026-05-27", endDate="2026-11-27",
                    applicationDeadline="2026-06-30",
                    formTemplate="FOODSTART",
                    description="...")
                « Une fois confirmé, on attaque la **Phase 1 : Découverte**.
                  Suggestions : sessions de 2h, lieu Co-working Tunis, ou Online.
                  Confirme à droite ou dis-moi ce que tu préfères. »
              TOUR 2 (après confirmation — programme #42 créé) :
                → add_programme_phase(programmeId=42, title="Découverte", startDate="2026-05-27",
                  endDate="2026-05-29", location="Co-working Tunis", durationKind="day")
                « Phase 1/4 confirmée → on passe à la **Phase 2 : Prototypage**.
                  Suggestions : 2 semaines, mentorat hebdo. Continue ? »
              … et ainsi de suite.

            ── COMMENT TU AGIS ──
            • LIRE d'abord, modifier ensuite : utilise search_* / get_* avant tout update_*.
            • Tout outil d'écriture (create_/update_/change_/add_/send_/invite_/set_/toggle_/update_landing_page)
              est mis en file d'attente et l'admin doit cliquer "Confirmer" dans l'UI.
              Tu n'as PAS besoin de redemander la confirmation par texte — l'UI s'en occupe.
            • Quand l'admin demande plusieurs actions, propose-les EN UN SEUL TOUR (plusieurs tool_calls
              dans la même réponse) — il les confirmera en lot.
            • ⚡ MODE PROACTIF — si l'admin dit "fais-le", "tout pour un programme complet", "remplis
              le reste", "toutes les sessions nécessaires", "tu décides", "comme tu veux", etc.
              alors NE POSE PAS de question. GÉNÈRE des valeurs par défaut SENSÉES en français
              (titres, descriptions courtes, dates échelonnées, lieu "À définir") et propose
              directement les tool_calls. Si l'admin n'aime pas, il modifiera. Mieux vaut un
              brouillon utile qu'une question stérile.
            • ── STRUCTURE PROGRAMME ── un Programme se construit avec ces tools :
                - create_programme — métadonnées (titre, dates, secteurs, status…)
                - add_programme_phase — UNE phase/session par appel (timeline)
                - add_programme_criterion — UN critère par appel (somme weights = 1.0)
              Ne mets JAMAIS phases/sessions/criteria dans update_programme.patch — ces champs n'existent
              pas et seront ignorés silencieusement.
              ⚠ Quand l'admin demande "crée un programme [+ éventuels détails]", n'appelle PAS
              create_programme tout seul. Utilise propose_plan pour bundler programme + phases
              + critères dans le wizard. L'admin décochera ce qu'il ne veut pas.
            • Photos / visuels / images → search_photos avec :
                - query : 3+ MOTS en anglais, RICHE et CIBLÉ. Pas "tunisia" tout seul.
                  Bons exemples : "tunisia tech startup founder", "modern coworking office sunlight",
                  "young african woman entrepreneur smiling", "startup team meeting laptop bright".
                  Mauvais : "tunisia", "office", "people".
                - context : "hero" pour le bandeau principal, "feature" pour les cards, "partner_logo" pour
                  un logo, "team" pour un portrait, "abstract" pour un fond décoratif.
              Ne dis JAMAIS "je ne peux pas trouver d'images" — tu peux, via search_photos.
            • ── PAGE D'ACCUEIL : workflow recommandé ──
                Pour rédiger / refondre une section de la page d'accueil :
                1. generate_landing_section(section="hero", brief="...") → renvoie un JSON prêt
                   (heroTitle, heroSubtitle, etc.). UN appel par section (hero, about, faq, cta, …).
                2. (si la section a une image) search_photos(query="...", context="hero"|"feature"|"team").
                3. update_landing_page(patch={ ...JSON généré..., heroImageUrl: <url de search_photos> }).
                Ne rédige PAS le copywriting à la main quand generate_landing_section peut le faire.
            • Workflow photos page d'accueil (DEUX étapes dans la MÊME réponse) :
                1. search_photos(query="modern tunisia tech coworking", context="hero", count=1)  // pour heroImageUrl
                2. search_photos(query="african startup founder presenting", context="feature", count=4) // pour features
                3. update_landing_page(patch={ heroImageUrl: <url result 1>, features:[{imageUrl:<url result 2[0]>}, ...] })
              Si les images retournées semblent hors contexte, refais search_photos avec une requête PLUS PRÉCISE
              (ajoute des adjectifs : "modern", "professional", "diverse", "bright") avant de proposer un patch.
            • ⚠ RÈGLE IMAGES INFLEXIBLE : tu ne fabriques JAMAIS d'URL d'image. Chaque imageUrl /
              heroImageUrl / logoUrl / bannerImageUrl que tu mets dans un patch DOIT être un copier-coller
              VERBATIM du champ `url` retourné par un appel récent à search_photos. Toute URL contenant
              "source.unsplash.com" est INTERDITE et sera REJETÉE par le serveur — cet endpoint est mort.
            • Dates : toujours format ISO YYYY-MM-DD. Heures : ISO 8601.
            • Si une action échoue → essaie une alternative avant d'abandonner.

            ── ERREURS À NE PAS FAIRE ──
            ✗ Préfacer chaque réponse par "Voici" / "Je vais" / "Bien sûr".
            ✗ Recopier le JSON de tes propres tool_calls dans le texte visible.
            ✗ Demander "voulez-vous que je..." quand tu peux directement proposer l'action.
            ✗ Demander "quel contenu / quels titres / quelles dates" quand l'admin dit explicitement
              "fais-le" ou "tu décides". Génère des défauts et propose.
            ✗ Inventer des ids, emails, dates que tu n'as pas vus dans un résultat d'outil.
            ✗ Mettre "..." ou "[à compléter]" dans un payload — soit tu as la donnée, soit tu cherches.
            ✗ Mettre `phases`, `sessions`, `criteria`, `partners` dans update_programme.patch.
              Ces champs SERONT IGNORÉS. Utilise add_programme_phase / add_programme_criterion à la place.

            ── DEMANDER UNE CLARIFICATION ──
            Quand la demande de l'admin est ambiguë ET tu ne peux pas raisonnablement deviner
            (ex. « envoie un email aux candidats » — lesquels ? acceptés/refusés/en cours ?),
            utilise **ask_user_choice** au lieu d'écrire une question texte. L'UI affiche
            des boutons cliquables — l'admin choisit en un clic au lieu de retaper.
              • 2-6 options max, labels courts (1-5 mots).
              • multiSelect=true pour "plusieurs choix possibles", false pour "un seul".
              • N'ajoute PAS d'autre texte avant/après — l'outil suffit à lui-même.
              • À NE PAS utiliser pour des questions oui/non triviales — propose directement les deux actions.
              • À NE PAS utiliser si le mode proactif s'applique (« fais-le », « tu décides »).

            ── MÉMOIRE ──
            • Tu as accès à 3 outils pour gérer ta mémoire persistante :
                - remember_fact(key, value, category?) — enregistre un fait
                - forget_fact(key) — oublie un fait
                - list_facts() — liste tous les faits actuels
            • Utilise-les proactivement quand l'admin t'apprend quelque chose d'important
              ("notre programme phare est X", "ne propose jamais Y", "le ton préféré est Z").
              Confirme par une note courte : « 📌 Noté. »

            Quand tu as fini, termine par une phrase courte qui invite à la suite logique
            (ex. "Confirme à droite ou demande-moi autre chose.").
            """.formatted(today, who, memoryBlock, today);
    }

    private final AiConversationRepository conversationRepo;
    private final AiMessageRepository      messageRepo;
    private final AdminActionRepository    actionRepo;
    private final com.medianet.adminai.repository.AiMemoryRepository memoryRepo;
    private final OpenRouterClient         llm;
    private final ToolExecutor             toolExecutor;
    private final ObjectMapper             json = new ObjectMapper();

    // ── Public API ────────────────────────────────────────────────────────────

    public ChatResponse chat(ChatRequest req, Long adminId, String adminName, String adminToken) {
        if (req.getMessage() == null || req.getMessage().isBlank()) {
            throw new IllegalArgumentException("Le message ne peut pas être vide.");
        }

        // 1. Find or create conversation
        AiConversation conv;
        if (req.getConversationId() != null) {
            conv = conversationRepo.findById(req.getConversationId())
                    .orElseThrow(() -> new IllegalArgumentException("Conversation introuvable: " + req.getConversationId()));
        } else {
            conv = AiConversation.builder()
                    .adminId(adminId)
                    .adminName(adminName != null ? adminName : "Admin")
                    .title(req.getMessage().length() > 80 ? req.getMessage().substring(0, 80) + "…" : req.getMessage())
                    .build();
            conv = conversationRepo.save(conv);
        }

        // 2. Persist user message (OpenAI format: {role:"user", content:"…"})
        appendMessage(conv, "user", Map.of("role", "user", "content", req.getMessage()));

        // 3. Agent loop — system prompt rebuilt each turn so date/admin are current
        final String systemPrompt = buildSystemPrompt(adminName);
        List<Long> pendingIds = new ArrayList<>();
        Set<String> toolsUsed = new LinkedHashSet<>();
        Map<String, Integer> toolCallCounts = new HashMap<>();
        StringBuilder finalText = new StringBuilder();
        boolean stoppedDueToToolSpam = false;
        boolean wroteThisTurn = false;  // becomes true after any write tool proposal
        com.medianet.adminai.dto.Clarification clarification = null;  // set when AI calls ask_user_choice
        com.medianet.adminai.dto.ActionPlan plan = null;              // set when AI calls propose_plan

        for (int loop = 0; loop < MAX_LOOPS; loop++) {
            List<Map<String, Object>> messages = loadOpenAiHistory(conv);
            // On the final iteration, after tool spam, OR after a write tool,
            // force tool_choice="none" so the model produces a text reply
            // (recap + suggestions for what's next) instead of more tool calls.
            boolean forceText = (loop == MAX_LOOPS - 1) || stoppedDueToToolSpam || wroteThisTurn;
            Map<String, Object> response = llm.chat(messages, ToolCatalog.toolsAsJson(),
                    systemPrompt, forceText ? "none" : "auto");

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
            if (choices == null || choices.isEmpty()) {
                finalText.append("(pas de réponse du modèle)");
                break;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            if (message == null) break;

            String content = stringOrNull(message.get("content"));
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> toolCalls = (List<Map<String, Object>>) message.get("tool_calls");
            String finishReason = stringOrNull(choices.get(0).get("finish_reason"));

            // ── Fallback for small models that emit tool calls as plain text ──
            // Llama 3.1 8B, Qwen 7B and other small / local models often return tool
            // calls inside the content string as <tool_call>{...}</tool_call> or bare
            // JSON instead of populating tool_calls[]. We recover by parsing the text.
            if ((toolCalls == null || toolCalls.isEmpty()) && content != null && !content.isBlank()) {
                ExtractResult er = extractAndStripToolCalls(content);
                if (!er.calls().isEmpty()) {
                    log.warn("Model emitted {} tool call(s) as plain text — recovering. " +
                             "Consider a larger model for reliable tool use.", er.calls().size());
                    toolCalls = er.calls();
                    content = er.cleanedText();
                    if (content == null || content.isBlank()) content = null;
                }
            }

            // Persist the assistant message verbatim so the next iteration includes
            // matching tool_calls (required by OpenAI API for tool-result threading).
            Map<String, Object> assistantMsg = new LinkedHashMap<>();
            assistantMsg.put("role", "assistant");
            assistantMsg.put("content", content);
            if (toolCalls != null && !toolCalls.isEmpty()) assistantMsg.put("tool_calls", toolCalls);
            appendMessage(conv, "assistant", assistantMsg);

            if (content != null && !content.isBlank()) finalText.append(content).append("\n");

            if (toolCalls == null || toolCalls.isEmpty() || "stop".equals(finishReason)) {
                // Model is done.
                break;
            }

            // Track whether any tool in this batch was a write (so we can short-circuit
            // the loop after running them all)
            boolean anyWrite = false;

            // Walk tool_calls and produce a "tool" message per call
            for (Map<String, Object> call : toolCalls) {
                String callId = (String) call.get("id");
                @SuppressWarnings("unchecked")
                Map<String, Object> fn = (Map<String, Object>) call.get("function");
                if (fn == null) continue;

                String toolName = (String) fn.get("name");
                String argsRaw  = (String) fn.get("arguments");
                Map<String, Object> args;
                try {
                    args = (argsRaw == null || argsRaw.isBlank())
                        ? Map.of()
                        : json.readValue(argsRaw, Map.class);
                } catch (Exception e) {
                    args = Map.of();
                }
                if (toolName != null) {
                    toolsUsed.add(toolName);
                    toolCallCounts.merge(toolName, 1, Integer::sum);
                    if (toolCallCounts.get(toolName) > MAX_SAME_TOOL_PER_TURN) {
                        log.warn("Tool {} spammed {}x in one turn — stopping loop.", toolName, toolCallCounts.get(toolName));
                        stoppedDueToToolSpam = true;
                    }
                }

                // ── Special tool: propose_plan ───────────────────────────
                // Builds an ActionPlan, surfaces it via ChatResponse, breaks
                // the loop. UI renders a wizard the admin reviews + executes.
                if ("propose_plan".equals(toolName)) {
                    try {
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> rawSteps = (List<Map<String, Object>>) args.get("steps");
                        if (rawSteps == null) rawSteps = List.of();
                        List<com.medianet.adminai.dto.ActionPlan.Step> steps = new ArrayList<>();
                        for (Map<String, Object> s : rawSteps) {
                            Integer dep = null;
                            Object depRaw = s.get("dependsOnStep");
                            if (depRaw instanceof Number n) dep = n.intValue();
                            else if (depRaw instanceof String str && !str.isBlank()) {
                                try { dep = Integer.parseInt(str.trim()); } catch (Exception ignored) {}
                            }
                            @SuppressWarnings("unchecked")
                            Map<String, Object> stepArgs = s.get("args") instanceof Map<?, ?> m
                                ? new java.util.LinkedHashMap<>((Map<String, Object>) m)
                                : new java.util.LinkedHashMap<>();
                            steps.add(com.medianet.adminai.dto.ActionPlan.Step.builder()
                                .label(String.valueOf(s.getOrDefault("label", s.get("tool"))))
                                .tool(String.valueOf(s.getOrDefault("tool", "")))
                                .args(stepArgs)
                                .optional(Boolean.TRUE.equals(s.get("optional")))
                                .dependsOnStep(dep)
                                .fillField(s.get("fillField") == null ? null : String.valueOf(s.get("fillField")))
                                .build());
                        }
                        plan = com.medianet.adminai.dto.ActionPlan.builder()
                            .title(String.valueOf(args.getOrDefault("title", "Plan")))
                            .summary(args.get("summary") == null ? null : String.valueOf(args.get("summary")))
                            .steps(steps)
                            .build();
                    } catch (Exception e) {
                        log.warn("Failed to parse propose_plan args: {}", e.getMessage());
                    }
                    Map<String, Object> toolMsg = new LinkedHashMap<>();
                    toolMsg.put("role", "tool");
                    toolMsg.put("tool_call_id", callId);
                    toolMsg.put("name", toolName);
                    toolMsg.put("content", "Plan présenté à l'admin — j'attends qu'il l'exécute ou l'ajuste.");
                    appendMessage(conv, "tool", toolMsg);
                    continue;
                }

                // ── Special tool: ask_user_choice ─────────────────────────
                // Builds a structured clarification, surfaces it via ChatResponse,
                // and breaks the loop. Admin's selection becomes the next prompt.
                if ("ask_user_choice".equals(toolName)) {
                    try {
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> opts = (List<Map<String, Object>>) args.get("options");
                        if (opts == null) opts = List.of();
                        List<com.medianet.adminai.dto.Clarification.Option> options = new ArrayList<>();
                        for (Map<String, Object> o : opts) {
                            options.add(com.medianet.adminai.dto.Clarification.Option.builder()
                                .label(String.valueOf(o.getOrDefault("label", "")))
                                .description(o.get("description") == null ? null : String.valueOf(o.get("description")))
                                .build());
                        }
                        clarification = com.medianet.adminai.dto.Clarification.builder()
                            .question(String.valueOf(args.getOrDefault("question", "")))
                            .options(options)
                            .multiSelect(Boolean.TRUE.equals(args.get("multiSelect")))
                            .build();
                    } catch (Exception e) {
                        log.warn("Failed to parse ask_user_choice args: {}", e.getMessage());
                    }
                    // Record a tool result so the conversation stays well-formed
                    Map<String, Object> toolMsg = new LinkedHashMap<>();
                    toolMsg.put("role", "tool");
                    toolMsg.put("tool_call_id", callId);
                    toolMsg.put("name", toolName);
                    toolMsg.put("content", "Question posée à l'admin — j'attends sa réponse.");
                    appendMessage(conv, "tool", toolMsg);
                    continue; // skip the rest of write/read handling
                }

                // ── Special tool: generate_landing_section ────────────────
                // Pure copywriting — runs the one-shot JSON generator and feeds
                // the result straight back so the model can pass it to
                // update_landing_page. No DB write, no confirmation.
                if ("generate_landing_section".equals(toolName)) {
                    String genResult;
                    try {
                        String section = String.valueOf(args.getOrDefault("section", "hero"));
                        String brief   = args.get("brief")  == null ? null : String.valueOf(args.get("brief"));
                        String locale  = args.get("locale") == null ? "fr" : String.valueOf(args.get("locale"));
                        Map<String, Object> generated = suggestLandingContent(section, brief, locale);
                        genResult = json.writeValueAsString(generated);
                    } catch (Exception ex) {
                        genResult = "ERREUR génération section: " + ex.getMessage();
                    }
                    Map<String, Object> toolMsg = new LinkedHashMap<>();
                    toolMsg.put("role", "tool");
                    toolMsg.put("tool_call_id", callId);
                    toolMsg.put("name", toolName);
                    toolMsg.put("content", genResult);
                    appendMessage(conv, "tool", toolMsg);
                    continue;
                }

                String toolResultText;
                if (ToolCatalog.isWrite(toolName)) {
                    // Pre-validate write-tool args at proposal time so the AI sees its
                    // mistakes (dead image URLs, etc.) inside this very turn and can
                    // retry — instead of failing only when the admin clicks Confirm.
                    try { toolExecutor.validateWriteArgs(toolName, args); }
                    catch (Exception ex) {
                        toolResultText = "ERREUR de validation: " + ex.getMessage()
                                + "  Corrige et propose l'action à nouveau.";
                        Map<String, Object> toolMsg = new LinkedHashMap<>();
                        toolMsg.put("role", "tool");
                        toolMsg.put("tool_call_id", callId);
                        toolMsg.put("name", toolName);
                        toolMsg.put("content", toolResultText);
                        appendMessage(conv, "tool", toolMsg);
                        continue;
                    }
                    anyWrite = true;
                    AdminAction pending = createPendingAction(conv, toolName, args, adminId, adminName, adminToken);
                    pendingIds.add(pending.getId());
                    // Wording carefully chosen so the AI does NOT confuse the action-id
                    // (internal queue number) with the entity-id (real DB id assigned
                    // only after the admin confirms).
                    toolResultText = "Proposition queued (action_queue_id=" + pending.getId() + "). " +
                                     "Aucune entité n'existe encore — l'admin doit cliquer Confirmer. " +
                                     "Tant que l'admin n'a pas confirmé, tu n'as PAS d'id réel à référencer. " +
                                     "Ne propose PAS d'action de suite qui dépend d'un id non encore créé. " +
                                     "Résumé : " + pending.getTitle();
                } else {
                    try {
                        Object result = toolExecutor.run(toolName, args, adminToken);
                        toolResultText = json.writeValueAsString(truncate(result));
                    } catch (Exception ex) {
                        toolResultText = "ERREUR: " + ex.getMessage();
                    }
                }

                // Persist the tool-result message (role:"tool", tool_call_id, content)
                Map<String, Object> toolMsg = new LinkedHashMap<>();
                toolMsg.put("role", "tool");
                toolMsg.put("tool_call_id", callId);
                toolMsg.put("name", toolName);
                toolMsg.put("content", toolResultText);
                appendMessage(conv, "tool", toolMsg);
            }

            // After a write proposal, no more tool_calls allowed — but the
            // model still needs to produce a CLOSING TEXT so the chat doesn't
            // end on a silent action. One more iteration with tool_choice="none".
            if (anyWrite) {
                wroteThisTurn = true;
                continue;
            }

            // ask_user_choice OR propose_plan ends the turn — admin reviews + acts.
            if (clarification != null || plan != null) {
                break;
            }

            // If the model spammed the same tool, let exactly ONE more iteration run
            // with tool_choice="none" so the model writes a proper text closing instead
            // of leaving the loop on unresolved tool calls. After that one iteration,
            // we exit because the model will have produced a text-only response.
        }

        // If we exited without any visible text from the assistant (loop maxed out,
        // tool spam, etc.), inject a synthetic closing message so the conversation
        // doesn't end on an unresolved tool_calls/tool_result pair. Without this,
        // the next user message would be sent to an LLM in a broken state and fail.
        String cleanedText = cleanAssistantText(finalText.toString());
        if (cleanedText.isEmpty()) {
            // Last-resort closing — context-aware.
            if (!pendingIds.isEmpty()) {
                cleanedText = "Action proposée — confirme à droite pour exécuter, "
                    + "ou dis-moi ce que tu veux changer.";
            } else if (clarification != null) {
                cleanedText = "Choisis une option ci-dessous.";
            } else if (plan != null) {
                cleanedText = "Plan prêt — revois les étapes et clique « Tout appliquer ».";
            } else if (stoppedDueToToolSpam) {
                cleanedText = "Je tourne en rond sur cette demande. Reformule ou simplifie pour qu'on avance.";
            } else {
                cleanedText = "Je n'ai pas pu finaliser ta demande. Précise ce que tu attends et je réessaie.";
            }
            Map<String, Object> closingMsg = new LinkedHashMap<>();
            closingMsg.put("role", "assistant");
            closingMsg.put("content", cleanedText);
            appendMessage(conv, "assistant", closingMsg);
        }

        return ChatResponse.builder()
                .conversationId(conv.getId())
                .text(cleanedText)
                .pendingActionIds(pendingIds)
                .suggestions(buildSuggestions(req.getMessage(), cleanedText, pendingIds, toolsUsed))
                .clarification(clarification)
                .plan(plan)
                .build();
    }

    // ── Output polishing ──────────────────────────────────────────────────────

    /**
     * Strip common LLM preambles so replies feel direct.
     * Removes openings like "Bien sûr,", "Voici", "Je vais", "Pas de problème,".
     */
    private static final java.util.regex.Pattern PREAMBLE = java.util.regex.Pattern.compile(
        "^\\s*(bien s[uû]r[\\s,!.]*|voici[\\s,!.]*|je vais[\\s\\w]{0,40}[:.,]|pas de probl[èe]me[\\s,!.]*|" +
        "avec plaisir[\\s,!.]*|d['e]accord[\\s,!.]*|tr[èe]s bien[\\s,!.]*|parfait[\\s,!.]*)+",
        java.util.regex.Pattern.CASE_INSENSITIVE);

    private String cleanAssistantText(String text) {
        if (text == null) return "";
        String out = PREAMBLE.matcher(text).replaceFirst("");
        return out.trim();
    }

    /**
     * Build 2-3 short follow-up prompts the admin can click as quick replies.
     * Heuristics based on what just happened — completely deterministic, no LLM call.
     */
    private List<String> buildSuggestions(String userMsg, String reply,
                                          List<Long> pendingIds, Set<String> toolsUsed) {
        List<String> out = new ArrayList<>(3);
        String low = (userMsg == null ? "" : userMsg.toLowerCase());

        if (!pendingIds.isEmpty()) {
            if (pendingIds.size() > 1) out.add("Confirmer toutes les actions");
            out.add("Voir les détails techniques");
        }
        if (toolsUsed.contains("search_photos")) {
            out.add("Trouve d'autres photos");
            out.add("Applique-les à la page d'accueil");
        }
        if (toolsUsed.contains("search_programmes") || toolsUsed.contains("get_programme")) {
            out.add("Combien de candidatures par programme ?");
            out.add("Statut des candidatures en cours");
        }
        if (toolsUsed.contains("search_candidatures")) {
            out.add("Filtrer par statut « EN_EVALUATION »");
            out.add("Envoie un email aux candidats acceptés");
        }
        if (toolsUsed.contains("search_users")) {
            out.add("Inviter un nouveau juré");
            out.add("Lister les comptes inactifs");
        }
        if (low.contains("programme") && pendingIds.isEmpty() && out.isEmpty()) {
            out.add("Liste les programmes ouverts");
        }
        // No suggestions if nothing happened — better than spammy generic chips
        // appearing on every reply.
        java.util.LinkedHashSet<String> dedup = new java.util.LinkedHashSet<>(out);
        return dedup.stream().limit(3).toList();
    }

    // ── Landing-page content suggestion (one-shot, no tool loop) ──────────────

    /**
     * Generate a JSON patch for a single landing-page section.
     * `section` is one of: hero, about, process, testimonials, faq, cta, stats, features.
     * Returns a map ready to merge into the LandingPage entity.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> suggestLandingContent(String section, String brief, String locale) {
        String sectionPrompt = switch (section) {
            case "hero" -> """
                Generate hero section content. Return ONLY a JSON object with these keys:
                {"heroBadge": "...", "heroTitle": "...", "heroSubtitle": "...",
                 "primaryCtaLabel": "...", "secondaryCtaLabel": "..."}.
                heroTitle: 4-9 words, punchy. heroSubtitle: 12-25 words. CTAs: 2-3 words each.
                """;
            case "about" -> """
                Generate "About us" section content. Return ONLY:
                {"aboutBadge": "...", "aboutTitle": "...", "aboutBody": "..."}.
                aboutTitle: 4-8 words. aboutBody: 80-130 words, friendly professional tone.
                """;
            case "process" -> """
                Generate a 4-step process timeline. Return ONLY:
                {"processTitle": "...", "processSubtitle": "...",
                 "processSteps": [{"title": "...", "description": "...", "icon": "FileText"}, ...]}.
                Each step description: 12-20 words. Icons from this list: FileText, ClipboardCheck, Users,
                Rocket, Target, Lightbulb, Trophy, Sparkles.
                """;
            case "testimonials" -> """
                Generate 3 realistic-sounding testimonials. Return ONLY:
                {"testimonialsTitle": "...",
                 "testimonials": [{"quote": "...", "authorName": "...", "authorRole": "..."}, ...]}.
                Quotes: 15-30 words, specific (mention concrete results), in first person.
                """;
            case "faq" -> """
                Generate 5 common FAQ entries. Return ONLY:
                {"faqTitle": "...", "faqs": [{"question": "...", "answer": "..."}, ...]}.
                Questions are concrete (cost, eligibility, duration, format, support).
                Answers: 1-3 sentences each.
                """;
            case "cta" -> """
                Generate the final call-to-action band. Return ONLY:
                {"ctaTitle": "...", "ctaSubtitle": "...", "ctaButtonLabel": "..."}.
                ctaTitle: 4-7 words. ctaSubtitle: 10-18 words. ctaButtonLabel: 2-4 words.
                """;
            case "stats" -> """
                Generate 4 realistic key-figures for an incubator landing page. Return ONLY:
                {"stats": [{"label": "...", "value": 12, "suffix": "+"}, ...]}.
                Values: realistic small numbers (10-500). Suffix: "+" for counts, "%" for rates.
                """;
            case "features" -> """
                Generate 4 platform features. Return ONLY:
                {"features": [{"title": "...", "description": "...", "icon": "Target"}, ...]}.
                title: 2-4 words. description: 12-20 words.
                Icons from this list: Target, Users, Globe2, Sparkles, Rocket, Award, Brain, Zap.
                """;
            default -> "Return an empty JSON object: {}";
        };

        String langInstr = "fr".equals(locale)
            ? "Write all values in French (français). Use proper accents."
            : "Write all values in " + locale + ".";

        String userMsg = (brief == null || brief.isBlank())
            ? "Generate sensible default content for a Tunisian startup incubator called Medianet Incubateur."
            : "Context from admin: " + brief.trim();

        String systemPrompt = "You are a website content writer. " + sectionPrompt + " " + langInstr
            + " CRITICAL: Output ONLY the raw JSON object — no markdown fences, no explanation, "
            + "no preamble. Start with { and end with }.";

        List<Map<String, Object>> messages = List.of(
            Map.of("role", "user", "content", userMsg)
        );
        // Force no tool use — this is plain JSON generation
        Map<String, Object> response = llm.chat(messages, List.of(), systemPrompt, "none");

        // Parse the assistant's text reply as JSON
        try {
            List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            String content = String.valueOf(message.get("content"));
            // Strip markdown fences if the model wrapped them anyway
            content = content.replaceAll("(?s)```\\w*", "").replaceAll("```", "").trim();
            // Find the first { and last } to be robust to leading/trailing chatter
            int start = content.indexOf('{');
            int end = content.lastIndexOf('}');
            if (start >= 0 && end > start) content = content.substring(start, end + 1);
            return json.readValue(content, Map.class);
        } catch (Exception e) {
            log.warn("landing-suggest failed to parse LLM response: {}", e.getMessage());
            return Map.of("error", "Génération échouée — le modèle a produit un format inattendu. Réessaie ou précise ta demande.");
        }
    }

    // ── Plan execution (batch from a propose_plan wizard submission) ─────

    /**
     * Execute the steps of an ActionPlan submitted from the wizard. Each step
     * is run sequentially; if a step has dependsOnStep + fillField set, we
     * back-fill that arg with the previous step's returned id before running.
     * No per-step pending-action queue — admin already approved via "Apply all".
     *
     * Returns a summary of what succeeded / failed.
     */
    public Map<String, Object> executePlan(com.medianet.adminai.dto.ActionPlan plan, Long conversationId,
                                           Long adminId, String adminName, String adminToken) {
        List<Map<String, Object>> results = new ArrayList<>();
        Map<Integer, Long> stepEntityIds = new HashMap<>();
        int ok = 0, failed = 0;

        for (int i = 0; i < plan.getSteps().size(); i++) {
            var step = plan.getSteps().get(i);
            Map<String, Object> args = step.getArgs() == null ? new java.util.LinkedHashMap<>()
                                                              : new java.util.LinkedHashMap<>(step.getArgs());

            // Back-fill dependency id if requested
            if (step.getDependsOnStep() != null && step.getFillField() != null) {
                Long depId = stepEntityIds.get(step.getDependsOnStep());
                if (depId != null) args.put(step.getFillField(), depId);
                else {
                    results.add(Map.of("step", i, "label", step.getLabel(), "status", "skipped",
                                       "error", "Dépendance #" + step.getDependsOnStep() + " a échoué — étape ignorée"));
                    failed++;
                    continue;
                }
            }

            try {
                Object result = toolExecutor.run(step.getTool(), args, adminToken);
                // Capture returned id if any (so later steps can reference it)
                if (result instanceof Map<?, ?> resMap) {
                    Object idObj = resMap.get("id");
                    if (idObj instanceof Number n) stepEntityIds.put(i, n.longValue());
                    else if (idObj instanceof String s) {
                        try { stepEntityIds.put(i, Long.parseLong(s)); } catch (Exception ignored) {}
                    }
                }
                results.add(Map.of("step", i, "label", step.getLabel(), "status", "ok",
                                   "result", truncate(result)));
                ok++;
            } catch (Exception e) {
                results.add(Map.of("step", i, "label", step.getLabel(), "status", "failed",
                                   "error", e.getMessage() == null ? "(no message)" : e.getMessage()));
                failed++;
                // Don't break — let independent steps run
            }
        }

        // Notify the AI in the conversation so the next chat turn has context
        if (conversationId != null) {
            AiConversation conv = conversationRepo.findById(conversationId).orElse(null);
            if (conv != null) {
                String summary = "🪄 Plan exécuté : " + ok + " réussie(s), " + failed + " échec(s). "
                    + "Détails dans les résultats.";
                Map<String, Object> sysMsg = new LinkedHashMap<>();
                sysMsg.put("role", "system");
                sysMsg.put("content", summary);
                appendMessage(conv, "system", sysMsg);
            }
        }

        return Map.of(
            "ok", ok,
            "failed", failed,
            "results", results
        );
    }

    // ── Action lifecycle ──────────────────────────────────────────────────────

    @Transactional
    public AdminAction confirmAction(Long actionId, Long adminId, String adminToken) {
        AdminAction a = actionRepo.findById(actionId)
                .orElseThrow(() -> new IllegalArgumentException("Action introuvable: " + actionId));
        if (a.getStatus() != ActionStatus.PENDING) {
            throw new IllegalStateException("Cette action n'est plus en attente (statut: " + a.getStatus() + ").");
        }
        Object result = null;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> args = json.readValue(a.getArgsJson(), Map.class);
            result = toolExecutor.run(a.getTool(), args, adminToken);
            a.setResultJson(json.writeValueAsString(result));
            a.setStatus(ActionStatus.EXECUTED);
            a.setExecutedAt(LocalDateTime.now());
        } catch (Exception e) {
            a.setStatus(ActionStatus.FAILED);
            a.setErrorMessage(e.getMessage());
            log.error("Action {} failed", actionId, e);
        }
        AdminAction saved = actionRepo.save(a);
        // Tell the AI what just happened so its next reply reflects reality
        // (previously it thought the action was still "en attente" forever).
        appendStatusChangeNote(saved, result);
        return saved;
    }

    @Transactional
    public AdminAction cancelAction(Long actionId, Long adminId) {
        AdminAction a = actionRepo.findById(actionId)
                .orElseThrow(() -> new IllegalArgumentException("Action introuvable: " + actionId));
        if (a.getStatus() != ActionStatus.PENDING) {
            throw new IllegalStateException("Seules les actions en attente peuvent être annulées.");
        }
        a.setStatus(ActionStatus.CANCELLED);
        AdminAction saved = actionRepo.save(a);
        appendStatusChangeNote(saved, null);
        return saved;
    }

    @Transactional
    public AdminAction revertAction(Long actionId, Long adminId, String adminToken) {
        AdminAction a = actionRepo.findById(actionId)
                .orElseThrow(() -> new IllegalArgumentException("Action introuvable: " + actionId));
        if (a.getStatus() != ActionStatus.EXECUTED) {
            throw new IllegalStateException("Seules les actions exécutées peuvent être annulées.");
        }
        try {
            toolExecutor.revert(a, adminToken);
            a.setStatus(ActionStatus.REVERTED);
            a.setRevertedAt(LocalDateTime.now());
        } catch (Exception e) {
            a.setErrorMessage("Annulation échouée: " + e.getMessage());
            log.error("Revert {} failed", actionId, e);
            throw new RuntimeException(a.getErrorMessage());
        }
        AdminAction saved = actionRepo.save(a);
        appendStatusChangeNote(saved, null);
        return saved;
    }

    /**
     * Catch the "ghost update" pattern: AI sent an update_programme patch with
     * a forbidden field (e.g. `sessions`, `phases`, `criteria`). Spring accepts
     * the PUT with 200 OK but silently drops the unknown field, so nothing
     * changes. Without warning, the AI thinks success and the user is confused.
     *
     * Returns a French warning string if we suspect a no-op, null otherwise.
     */
    @SuppressWarnings("unchecked")
    private String detectNoOpUpdate(AdminAction a, Object executionResult) {
        if (a.getTool() == null || !a.getTool().startsWith("update_")) return null;
        if (!(executionResult instanceof Map<?, ?> after)) return null;
        try {
            Map<String, Object> args = json.readValue(a.getArgsJson(), Map.class);
            Object patchObj = args.get("patch");
            if (!(patchObj instanceof Map<?, ?> patch) || patch.isEmpty()) return null;

            java.util.Set<String> forbidden = java.util.Set.of("phases", "sessions", "criteria",
                    "partners", "evaluationCriteria", "programmeCriteria");
            java.util.Set<String> rejected = new java.util.LinkedHashSet<>();
            for (Object k : patch.keySet()) {
                String key = String.valueOf(k);
                if (forbidden.contains(key))     rejected.add(key);
                else if (!after.containsKey(key)) rejected.add(key);
            }
            if (rejected.isEmpty()) return null;
            return "Les champs " + rejected + " n'existent pas sur Programme et ont été IGNORÉS. "
                 + "Pour ajouter des sessions/phases, utilise add_programme_phase. "
                 + "Pour ajouter des critères, utilise add_programme_criterion.";
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * After an action transitions out of PENDING, append a synthetic "system"
     * note to the conversation so the LLM sees what really happened on its
     * next turn. Without this the AI keeps repeating "still pending — confirm
     * first" because its view of the world is frozen at the proposal moment.
     *
     * <p>Includes the upstream result (for confirms) so the AI can reference
     * the real db id when the user follows up with "now update the dates"
     * type requests.
     */
    private void appendStatusChangeNote(AdminAction a, Object executionResult) {
        if (a.getConversationId() == null) return;
        AiConversation conv = conversationRepo.findById(a.getConversationId()).orElse(null);
        if (conv == null) return;

        String label;
        switch (a.getStatus()) {
            case EXECUTED:
                String tool = a.getTool() == null ? "" : a.getTool();
                String verb = tool.startsWith("create_")    ? "créé"
                            : tool.startsWith("add_")       ? "ajouté"
                            : tool.startsWith("update_")    ? "mis à jour"
                            : tool.startsWith("change_")    ? "modifié"
                            : tool.startsWith("send_")      ? "envoyé"
                            : tool.startsWith("invite_")    ? "envoyée"
                            : tool.startsWith("toggle_")    ? "basculé"
                            : tool.startsWith("set_")       ? "appliqué"
                            : "exécuté";

                // Surface a real entity id when the upstream returned one.
                String entityHint = "";
                if (executionResult instanceof Map<?, ?> resMap) {
                    Object newId = resMap.get("id");
                    if (newId != null) {
                        entityHint = tool.startsWith("create_") || tool.startsWith("add_")
                            ? " (id=" + newId + ")"
                            : " (#" + newId + ")";
                    }
                }

                // Detect probable no-op updates: PUT /programmes returns the entity unchanged
                // because Spring quietly drops unknown fields. We compare BEFORE vs AFTER on
                // the fields the patch tried to set.
                String warn = detectNoOpUpdate(a, executionResult);

                label = "✅ Action #" + a.getId() + " « " + a.getTitle() + " » " + verb + entityHint + "."
                      + (warn == null ? " Tu peux enchaîner avec d'autres actions qui référencent ce résultat."
                                      : " ⚠ " + warn);
                break;
            case FAILED:
                label = "❌ L'admin a confirmé l'action #" + a.getId() + " mais l'exécution serveur a ÉCHOUÉ : "
                        + (a.getErrorMessage() == null ? "(sans message)" : a.getErrorMessage())
                        + ". Propose une correction ou explique pourquoi.";
                break;
            case CANCELLED:
                label = "🚫 L'admin a REFUSÉ l'action #" + a.getId() + " (« " + a.getTitle() + " »). "
                        + "N'y reviens pas sans nouvelle instruction.";
                break;
            case REVERTED:
                label = "↩ L'admin a ANNULÉ l'action #" + a.getId() + " (« " + a.getTitle() + " ») "
                        + "après exécution. L'état précédent a été restauré.";
                break;
            default:
                return;
        }

        Map<String, Object> sysMsg = new LinkedHashMap<>();
        sysMsg.put("role", "system");
        sysMsg.put("content", label);
        appendMessage(conv, "system", sysMsg);
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private AdminAction createPendingAction(AiConversation conv, String tool,
                                            Map<String, Object> args,
                                            Long adminId, String adminName, String adminToken) {
        String title    = describeAction(tool, args);
        String descr    = describeArgs(args);
        String before   = toolExecutor.captureBeforeState(tool, args, adminToken);
        String argsJson;
        try { argsJson = json.writeValueAsString(args); } catch (Exception e) { argsJson = "{}"; }

        AdminAction a = AdminAction.builder()
                .conversationId(conv.getId())
                .tool(tool)
                .title(title)
                .description(descr)
                .argsJson(argsJson)
                .beforeStateJson(before)
                .status(ActionStatus.PENDING)
                .adminId(adminId)
                .adminName(adminName)
                .build();
        return actionRepo.save(a);
    }

    private String describeAction(String tool, Map<String, Object> args) {
        return switch (tool) {
            // Programmes
            case "create_programme"        -> "Créer le programme « " + args.getOrDefault("title", "(sans titre)") + " »";
            case "update_programme"        -> "Mettre à jour le programme #" + args.get("id");
            case "delete_programme"        -> "⚠ SUPPRIMER le programme #" + args.get("id");
            case "change_programme_status" -> "Changer le statut du programme #" + args.get("id") + " → " + args.get("status");
            // Phases
            case "add_programme_phase"     -> "Ajouter la phase « " + args.getOrDefault("title", "(sans titre)") + " » au programme #" + args.get("programmeId");
            case "update_programme_phase"  -> "Mettre à jour la phase #" + args.get("phaseId") + " du programme #" + args.get("programmeId");
            case "delete_programme_phase"  -> "Supprimer la phase #" + args.get("phaseId") + " du programme #" + args.get("programmeId");
            // Criteria
            case "add_programme_criterion"    -> "Ajouter le critère « " + args.getOrDefault("name", "(sans nom)") + " » (poids " + args.getOrDefault("weight", "?") + ") au programme #" + args.get("programmeId");
            case "update_programme_criterion" -> "Mettre à jour le critère #" + args.get("criterionId") + " du programme #" + args.get("programmeId");
            case "delete_programme_criterion" -> "Supprimer le critère #" + args.get("criterionId") + " du programme #" + args.get("programmeId");
            // Candidatures
            case "accept_candidature"      -> "Accepter la candidature #" + args.get("id");
            case "reject_candidature"      -> "Refuser la candidature #" + args.get("id");
            case "assign_jury_to_candidature" -> "Assigner le juré #" + args.get("juryUserId") + " à la candidature #" + args.get("candidatureId");
            // Tasks
            case "create_task"             -> "Créer une tâche : « " + args.getOrDefault("title", "(sans titre)") + " »";
            case "update_task"             -> "Mettre à jour la tâche #" + args.get("id");
            case "change_task_status"      -> "Changer le statut de la tâche #" + args.get("id") + " → " + args.get("status");
            case "delete_task"             -> "Supprimer la tâche #" + args.get("id");
            // Partners
            case "create_partner"          -> "Créer le partenaire « " + args.getOrDefault("name", "(sans nom)") + " »";
            case "link_partner_to_programme"     -> "Lier le partenaire #" + args.get("partnerId") + " au programme #" + args.get("programmeId");
            case "unlink_partner_from_programme" -> "Délier le partenaire #" + args.get("partnerId") + " du programme #" + args.get("programmeId");
            // Notifications + users
            case "send_email"              -> "Envoyer un email à " + args.get("toEmails");
            case "invite_user"             -> "Inviter " + args.get("recipientEmail") + " comme " + args.get("type");
            case "resend_invitation"       -> "Renvoyer l'invitation #" + args.get("id");
            case "cancel_invitation"       -> "Annuler l'invitation #" + args.get("id");
            case "set_user_roles"          -> "Définir les rôles de l'utilisateur #" + args.get("userId") + " → " + args.get("roles");
            case "toggle_user_active"      -> "Activer/désactiver l'utilisateur #" + args.get("userId");
            case "update_landing_page"     -> "Mettre à jour la page d'accueil";
            case "remember_fact"           -> "📌 Mémoriser : « " + args.get("key") + " » = « " + args.get("value") + " »";
            case "forget_fact"             -> "🗑 Oublier : « " + args.get("key") + " »";
            default                        -> "Action : " + tool;
        };
    }

    private String describeArgs(Map<String, Object> args) {
        try { return json.writerWithDefaultPrettyPrinter().writeValueAsString(args); }
        catch (Exception e) { return args.toString(); }
    }

    private void appendMessage(AiConversation conv, String role, Object content) {
        try {
            AiMessage m = AiMessage.builder()
                    .conversation(conv)
                    .role(role)
                    .contentJson(json.writeValueAsString(content))
                    .build();
            messageRepo.save(m);
        } catch (Exception e) {
            log.error("Could not persist message", e);
        }
    }

    /**
     * Load conversation history in OpenAI Chat-Completions format.
     * Each row in ai_messages stores a single complete message object as JSON;
     * we just deserialize them in order.
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> loadOpenAiHistory(AiConversation conv) {
        List<AiMessage> messages = messageRepo.findByConversationIdOrderByIdAsc(conv.getId());
        List<Map<String, Object>> out = new ArrayList<>(messages.size());
        for (AiMessage m : messages) {
            try {
                Object parsed = json.readValue(m.getContentJson(), Object.class);
                if (parsed instanceof Map<?, ?> map) {
                    out.add((Map<String, Object>) map);
                }
            } catch (Exception e) {
                log.warn("Skipping malformed message {}", m.getId());
            }
        }
        return sanitizeForLlm(out);
    }

    /**
     * Defensive cleanup of the message stream before sending it to the LLM.
     * OpenAI-compatible APIs reject conversations where an assistant message has
     * tool_calls without matching tool result messages, OR a tool message without
     * a preceding assistant tool_call with that id. We drop both kinds of orphans.
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> sanitizeForLlm(List<Map<String, Object>> messages) {
        if (messages.isEmpty()) return messages;

        // Build the set of ALL tool_call_ids ever emitted by assistant messages.
        // Tool messages whose tool_call_id isn't in this set are pure orphans and
        // must be dropped before sending to the LLM.
        java.util.Set<String> allCallIds = new java.util.HashSet<>();
        for (Map<String, Object> m : messages) {
            if (!"assistant".equals(m.get("role"))) continue;
            List<Map<String, Object>> calls = (List<Map<String, Object>>) m.get("tool_calls");
            if (calls == null) continue;
            for (Map<String, Object> c : calls) {
                Object id = c.get("id");
                if (id != null) allCallIds.add(id.toString());
            }
        }

        // Walk from the end: if the tail is assistant-with-tool_calls but the
        // expected tool_call_ids aren't all resolved in messages after it,
        // drop the assistant message AND any tool messages after it (which
        // would themselves be orphaned by the drop).
        int cutAt = -1;
        for (int i = messages.size() - 1; i >= 0; i--) {
            Map<String, Object> m = messages.get(i);
            if (!"assistant".equals(m.get("role"))) continue;
            List<Map<String, Object>> calls = (List<Map<String, Object>>) m.get("tool_calls");
            if (calls == null || calls.isEmpty()) break;
            java.util.Set<String> expected = new java.util.HashSet<>();
            for (Map<String, Object> c : calls) {
                Object id = c.get("id");
                if (id != null) expected.add(id.toString());
            }
            for (int j = i + 1; j < messages.size(); j++) {
                Map<String, Object> n = messages.get(j);
                if ("tool".equals(n.get("role"))) {
                    Object tid = n.get("tool_call_id");
                    if (tid != null) expected.remove(tid.toString());
                }
            }
            if (!expected.isEmpty()) {
                log.warn("Dropping orphan assistant tool_calls (unresolved ids: {}) from history", expected);
                cutAt = i;
            }
            break;
        }

        List<Map<String, Object>> trimmed = cutAt >= 0
            ? new ArrayList<>(messages.subList(0, cutAt))
            : new ArrayList<>(messages);

        // Drop any tool messages whose tool_call_id has no assistant parent in the
        // (potentially trimmed) history. This catches the case where the orphan
        // assistant got dropped but its tool results stayed.
        List<Map<String, Object>> clean = new ArrayList<>(trimmed.size());
        for (Map<String, Object> m : trimmed) {
            if ("tool".equals(m.get("role"))) {
                Object tid = m.get("tool_call_id");
                if (tid == null || !allCallIds.contains(tid.toString())) {
                    log.debug("Dropping orphan tool message (id {})", tid);
                    continue;
                }
            }
            clean.add(m);
        }
        return clean;
    }

    /**
     * Trim and project upstream responses so the model isn't overwhelmed.
     * For lists of records we keep only the most-useful fields (id, title, status, dates),
     * dropping verbose nested objects. Cap at 20 items per tool result.
     */
    private Object truncate(Object result) {
        return truncate(result, null);
    }

    private Object truncate(Object result, String toolName) {
        if (result instanceof List<?> list) {
            int total = list.size();
            List<?> capped = total > 20 ? list.subList(0, 20) : list;
            List<Object> projected = new ArrayList<>(capped.size());
            for (Object item : capped) projected.add(projectItem(item));
            if (total > 20) {
                return Map.of("items", projected, "truncated", true, "totalCount", total);
            }
            return projected;
        }
        return result;
    }

    /**
     * Keep the high-signal fields of a record so the LLM context stays tight.
     * Includes user-visible content (description, imageUrl) so the AI can reason
     * about what's actually there, not just ids.
     */
    private static final Set<String> KEEP_FIELDS = Set.of(
        // identity
        "id", "title", "name", "firstName", "lastName", "email", "phone",
        // descriptive
        "description", "summary", "shortDescription", "tagline",
        // visuals
        "imageUrl", "logoUrl", "bannerImageUrl", "heroImageUrl", "thumbnailUrl", "icon",
        // status & lifecycle
        "status", "type", "role", "roles", "active", "isOpen", "phase", "currentPhase",
        "priority", "completed", "done",
        // dates
        "startDate", "endDate", "createdAt", "updatedAt", "deadline", "submittedAt",
        "dueDate", "applicationDeadline", "executedAt", "acceptedAt", "expiresAt",
        // task fields
        "programmeId", "programmeName", "assignedToUserId", "assigneeName",
        // candidature fields
        "candidateName", "candidateEmail", "projectName", "score", "weightedScore",
        "averageScore", "submissionCount", "juryAssignedTo",
        // invitation fields
        "recipientEmail", "recipientName", "token", "phaseId",
        // partner fields
        "partnerCount",
        // structure (kept shallow — see truncate())
        "phases", "criteria", "evaluationCriteria", "features", "partners", "objectives", "benefits"
    );

    private Object projectItem(Object item) {
        if (!(item instanceof Map<?, ?> map)) return item;
        Map<String, Object> small = new LinkedHashMap<>();
        for (Map.Entry<?, ?> e : map.entrySet()) {
            String k = String.valueOf(e.getKey());
            if (KEEP_FIELDS.contains(k)) {
                Object v = e.getValue();
                // Trim long string fields so a single 5KB description doesn't blow context
                if (v instanceof String s && s.length() > 280) {
                    v = s.substring(0, 280) + "…";
                }
                // Cap nested arrays at 5 items so phases/criteria don't dominate
                if (v instanceof List<?> list && list.size() > 5) {
                    v = new java.util.ArrayList<>(list.subList(0, 5));
                }
                small.put(k, v);
            }
        }
        return small.isEmpty() ? item : small;
    }

    private static String stringOrNull(Object o) {
        return o == null ? null : o.toString();
    }

    // ── Text-tool-call fallback (for small Llama / Qwen / Mistral variants) ──

    /**
     * Markers we use to FIND the start of a leaked tool call inside `content`.
     * For each match we then extract the JSON by balanced-brace counting
     * (regex-only approaches break on nested objects like {"arguments":{...}}).
     */
    private static final java.util.regex.Pattern[] TOOL_CALL_OPEN = {
        // Qwen native: <tool_call>{...}</tool_call>
        java.util.regex.Pattern.compile("(?i)<tool_call>"),
        // Markdown fence with json language hint
        java.util.regex.Pattern.compile("(?i)```\\s*json\\b"),
        // Plain markdown fence
        java.util.regex.Pattern.compile("```"),
        // Llama bare JSON: anywhere we see {"name": "..." / {"type":"function" / {"function":"..."
        java.util.regex.Pattern.compile("(?s)\\{\\s*\"(?:name|function|tool|type)\""),
    };

    /**
     * Locate every leaked tool-call JSON block in the model's text content and
     * convert each one into an OpenAI-format tool_call object.
     *
     * <p>Returns a record holding both the recovered calls AND the cleaned
     * text (tool-call syntax removed) so a single pass does double duty.
     */
    private record ExtractResult(List<Map<String, Object>> calls, String cleanedText) {}

    private ExtractResult extractAndStripToolCalls(String content) {
        List<Map<String, Object>> calls = new ArrayList<>();
        StringBuilder cleaned = new StringBuilder(content.length());
        int cursor = 0;

        while (cursor < content.length()) {
            // Find the next earliest opening marker
            int bestStart = -1, bestPatternLen = 0, bestPatternIdx = -1;
            for (int p = 0; p < TOOL_CALL_OPEN.length; p++) {
                java.util.regex.Matcher m = TOOL_CALL_OPEN[p].matcher(content);
                if (m.find(cursor) && (bestStart == -1 || m.start() < bestStart)) {
                    bestStart = m.start();
                    bestPatternLen = m.end() - m.start();
                    bestPatternIdx = p;
                }
            }
            if (bestStart < 0) {
                cleaned.append(content, cursor, content.length());
                break;
            }

            // Append everything before the opening marker to cleaned text
            cleaned.append(content, cursor, bestStart);

            // BARE-JSON case: the marker IS the `{` (pattern starts with `{`).
            // If we advance past the marker we'd land mid-JSON and the brace
            // counter would close on the first nested object. So check whether
            // the matched span begins with `{` and treat that as the openBrace.
            int openBrace;
            if (content.charAt(bestStart) == '{') {
                openBrace = bestStart;
            } else {
                int searchFrom = bestStart + bestPatternLen;
                openBrace = findFirstOpenBrace(content, searchFrom);
            }
            if (openBrace < 0) {
                // No JSON after the marker — keep cursor moving so we don't loop
                cursor = bestStart + bestPatternLen;
                cleaned.append(content, bestStart, cursor);
                continue;
            }
            int closeBrace = findMatchingClose(content, openBrace);
            if (closeBrace < 0) {
                cursor = bestStart + bestPatternLen;
                cleaned.append(content, bestStart, cursor);
                continue;
            }

            String snippet = content.substring(openBrace, closeBrace + 1);
            Map<String, Object> call = parseLeakedCall(snippet, calls.size());

            // Advance cursor past the JSON + any closing marker
            cursor = closeBrace + 1;
            // Skip closing </tool_call> tag if Qwen style
            java.util.regex.Matcher closeTag =
                java.util.regex.Pattern.compile("\\A\\s*</tool_call>", java.util.regex.Pattern.CASE_INSENSITIVE)
                    .matcher(content.substring(cursor));
            if (closeTag.find()) cursor += closeTag.end();
            // Skip closing markdown ``` fence
            java.util.regex.Matcher closeFence =
                java.util.regex.Pattern.compile("\\A\\s*```").matcher(content.substring(cursor));
            if (closeFence.find()) cursor += closeFence.end();

            if (call != null) {
                calls.add(call);
                // Trim the trailing garbage word before the marker too — e.g. "ronics " is leftover
                // from a half-emitted "electronics" before the model jumped to the tool call.
                int len = cleaned.length();
                int wordStart = len;
                while (wordStart > 0 && !Character.isWhitespace(cleaned.charAt(wordStart - 1))) wordStart--;
                if (wordStart < len) cleaned.setLength(wordStart);
            } else {
                // Failed to parse — leave the original text in so the user can see what happened
                cleaned.append(content, bestStart, cursor);
            }
        }

        String out = cleaned.toString().trim();
        return new ExtractResult(calls, out);
    }

    /** Find next `{` from `from` skipping whitespace, language hints, and stray punctuation. */
    private static int findFirstOpenBrace(String s, int from) {
        for (int i = from; i < s.length(); i++) {
            if (s.charAt(i) == '{') return i;
            // Anything more than 50 chars between marker and `{` → probably not a tool call
            if (i - from > 50) return -1;
        }
        return -1;
    }

    /** Brace-counting match for `{...}` starting at position `open`. String-aware. */
    private static int findMatchingClose(String s, int open) {
        int depth = 0;
        boolean inString = false;
        boolean escape = false;
        for (int i = open; i < s.length(); i++) {
            char c = s.charAt(i);
            if (escape) { escape = false; continue; }
            if (c == '\\' && inString) { escape = true; continue; }
            if (c == '"') { inString = !inString; continue; }
            if (inString) continue;
            if (c == '{') depth++;
            else if (c == '}') {
                depth--;
                if (depth == 0) return i;
            }
        }
        return -1;
    }

    /**
     * Parse a JSON snippet into an OpenAI tool_call. Tolerates synonym field names
     * (name/function/tool, arguments/parameters/input/args). Returns null if no
     * valid call could be extracted.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> parseLeakedCall(String snippet, int seq) {
        Map<String, Object> parsed;
        try { parsed = json.readValue(snippet, Map.class); }
        catch (Exception e) {
            try { parsed = json.readValue(snippet.replace("'", "\""), Map.class); }
            catch (Exception e2) { return null; }
        }
        String name = stringField(parsed, "name", "function", "tool");
        // Some models emit { "type": "function", "function": { "name": "...", "arguments": {...} } }
        if (name == null && parsed.get("function") instanceof Map<?, ?> nested) {
            name = stringField((Map<String, Object>) nested, "name");
            if (parsed.get("arguments") == null) parsed.put("arguments", ((Map<String, Object>) nested).get("arguments"));
        }
        if (name == null) return null;

        Object rawArgs = firstNonNull(parsed.get("arguments"), parsed.get("parameters"),
                                       parsed.get("input"), parsed.get("args"));
        if (rawArgs == null) rawArgs = Map.of();

        String argStr;
        if (rawArgs instanceof String s) argStr = s;
        else {
            try { argStr = json.writeValueAsString(rawArgs); }
            catch (Exception e) { argStr = "{}"; }
        }

        Map<String, Object> call = new LinkedHashMap<>();
        call.put("id", "call_recovered_" + System.nanoTime() + "_" + seq);
        call.put("type", "function");
        call.put("function", Map.of("name", name, "arguments", argStr));
        return call;
    }

    private static String stringField(Map<String, Object> m, String... keys) {
        for (String k : keys) {
            Object v = m.get(k);
            if (v instanceof String s && !s.isBlank()) return s;
        }
        return null;
    }

    private static Object firstNonNull(Object... values) {
        for (Object v : values) if (v != null) return v;
        return null;
    }

    /** Back-compat shims for the existing callers. */
    private List<Map<String, Object>> extractToolCallsFromText(String content) {
        return extractAndStripToolCalls(content).calls();
    }
    private String stripToolCallSyntax(String content) {
        return extractAndStripToolCalls(content).cleanedText();
    }
}
