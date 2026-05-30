package com.medianet.programme.service;

import com.medianet.programme.dto.LandingPageDto;
import com.medianet.programme.entity.LandingFaq;
import com.medianet.programme.entity.LandingFeature;
import com.medianet.programme.entity.LandingPage;
import com.medianet.programme.entity.LandingProcessStep;
import com.medianet.programme.entity.LandingStat;
import com.medianet.programme.entity.LandingTestimonial;
import com.medianet.programme.repository.LandingPageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class LandingPageService {

    private final LandingPageRepository repository;

    private static final Long SINGLETON_ID = 1L;

    /** Return the single landing-page row, creating it with defaults on first call. */
    @Transactional
    public LandingPageDto get() {
        LandingPage page = repository.findById(SINGLETON_ID)
                .orElseGet(this::seedDefaults);
        return toDto(page);
    }

    @Transactional
    public LandingPageDto update(LandingPageDto req) {
        LandingPage p = repository.findById(SINGLETON_ID).orElseGet(this::seedDefaults);

        if (req.getHeroTitle()         != null) p.setHeroTitle(req.getHeroTitle());
        if (req.getHeroSubtitle()      != null) p.setHeroSubtitle(req.getHeroSubtitle());
        if (req.getHeroBadge()         != null) p.setHeroBadge(req.getHeroBadge());
        if (req.getHeroImageUrl()      != null) p.setHeroImageUrl(req.getHeroImageUrl());

        if (req.getPrimaryCtaLabel()   != null) p.setPrimaryCtaLabel(req.getPrimaryCtaLabel());
        if (req.getPrimaryCtaLink()    != null) p.setPrimaryCtaLink(req.getPrimaryCtaLink());
        if (req.getSecondaryCtaLabel() != null) p.setSecondaryCtaLabel(req.getSecondaryCtaLabel());
        if (req.getSecondaryCtaLink()  != null) p.setSecondaryCtaLink(req.getSecondaryCtaLink());

        if (req.getStats()    != null) p.setStats(new ArrayList<>(req.getStats()));
        if (req.getFeatures() != null) p.setFeatures(new ArrayList<>(req.getFeatures()));

        // About
        if (req.getAboutBadge()    != null) p.setAboutBadge(req.getAboutBadge());
        if (req.getAboutTitle()    != null) p.setAboutTitle(req.getAboutTitle());
        if (req.getAboutBody()     != null) p.setAboutBody(req.getAboutBody());
        if (req.getAboutImageUrl() != null) p.setAboutImageUrl(req.getAboutImageUrl());

        // Process
        if (req.getProcessTitle()    != null) p.setProcessTitle(req.getProcessTitle());
        if (req.getProcessSubtitle() != null) p.setProcessSubtitle(req.getProcessSubtitle());
        if (req.getProcessSteps()    != null) p.setProcessSteps(new ArrayList<>(req.getProcessSteps()));

        // Testimonials
        if (req.getTestimonialsTitle() != null) p.setTestimonialsTitle(req.getTestimonialsTitle());
        if (req.getTestimonials()      != null) p.setTestimonials(new ArrayList<>(req.getTestimonials()));

        // FAQ
        if (req.getFaqTitle() != null) p.setFaqTitle(req.getFaqTitle());
        if (req.getFaqs()     != null) p.setFaqs(new ArrayList<>(req.getFaqs()));

        if (req.getCtaTitle()       != null) p.setCtaTitle(req.getCtaTitle());
        if (req.getCtaSubtitle()    != null) p.setCtaSubtitle(req.getCtaSubtitle());
        if (req.getCtaButtonLabel() != null) p.setCtaButtonLabel(req.getCtaButtonLabel());
        if (req.getCtaButtonLink()  != null) p.setCtaButtonLink(req.getCtaButtonLink());
        if (req.getFooterText()     != null) p.setFooterText(req.getFooterText());

        // Theme + visibility
        // Empty string → null = "clear back to the Tailwind default palette".
        // Non-empty hex → store as-is (admin chose a custom color).
        if (req.getPrimaryColor() != null) p.setPrimaryColor(req.getPrimaryColor().isBlank() ? null : req.getPrimaryColor());
        if (req.getAccentColor()  != null) p.setAccentColor(req.getAccentColor().isBlank()  ? null : req.getAccentColor());
        if (req.getShowHero()        != null) p.setShowHero(req.getShowHero());
        if (req.getShowStats()       != null) p.setShowStats(req.getShowStats());
        if (req.getShowAbout()       != null) p.setShowAbout(req.getShowAbout());
        if (req.getShowFeatures()    != null) p.setShowFeatures(req.getShowFeatures());
        if (req.getShowProcess()     != null) p.setShowProcess(req.getShowProcess());
        if (req.getShowTestimonials()!= null) p.setShowTestimonials(req.getShowTestimonials());
        if (req.getShowFaq()         != null) p.setShowFaq(req.getShowFaq());
        if (req.getShowCta()         != null) p.setShowCta(req.getShowCta());
        if (req.getShowProgrammes()  != null) p.setShowProgrammes(req.getShowProgrammes());
        if (req.getProgrammesTitle()    != null) p.setProgrammesTitle(req.getProgrammesTitle());
        if (req.getProgrammesSubtitle() != null) p.setProgrammesSubtitle(req.getProgrammesSubtitle());
        if (req.getProgrammesLimit()    != null) p.setProgrammesLimit(req.getProgrammesLimit());
        if (req.getSectionOrder()    != null) p.setSectionOrder(req.getSectionOrder());

        return toDto(repository.save(p));
    }

    /** Wipe customisations and reseed with defaults. */
    @Transactional
    public LandingPageDto reset() {
        repository.deleteAll();
        return toDto(seedDefaults());
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private LandingPage seedDefaults() {
        LandingPage p = LandingPage.builder()
                .id(SINGLETON_ID)
                .heroBadge("Plateforme d'incubation propulsée par l'IA")
                .stats(new ArrayList<>(List.of(
                        LandingStat.builder().label("Programmes actifs").value(12).suffix("+").build(),
                        LandingStat.builder().label("Startups incubées").value(150).suffix("+").build(),
                        LandingStat.builder().label("Taux de succès").value(87).suffix("%").build(),
                        LandingStat.builder().label("Mentors experts").value(40).suffix("+").build()
                )))
                .features(new ArrayList<>(List.of(
                        LandingFeature.builder().icon("Target")
                                .title("Sélection IA")
                                .description("Notre algorithme IA évalue les candidatures selon des critères métier pondérés définis par chaque programme.").build(),
                        LandingFeature.builder().icon("Users")
                                .title("Matching intelligent")
                                .description("Mise en relation automatique entre porteurs de projets et mentors basée sur les compétences et le secteur.").build(),
                        LandingFeature.builder().icon("Globe2")
                                .title("Multi-programmes")
                                .description("Programmes simultanés avec phases, critères et jurys personnalisés pour chaque secteur.").build(),
                        LandingFeature.builder().icon("Sparkles")
                                .title("Suivi en temps réel")
                                .description("Notifications et tableaux de bord pour suivre votre candidature à chaque étape.").build()
                )))
                .aboutBadge("Notre mission")
                .aboutTitle("Accélérer l'innovation tunisienne")
                .aboutBody("Medianet Incubateur est l'écosystème de référence pour transformer une idée " +
                        "en entreprise. Depuis 2018, nous avons accompagné plus de 150 startups dans 12 " +
                        "secteurs en combinant mentorat humain, programmes structurés et un moteur IA " +
                        "de matching et d'évaluation.")
                .processTitle("Comment ça marche")
                .processSubtitle("4 étapes simples pour rejoindre un programme")
                .processSteps(new ArrayList<>(List.of(
                        LandingProcessStep.builder().icon("FileText")
                                .title("1. Candidature")
                                .description("Remplissez le formulaire en ligne en 10 minutes. Pas de frais.").build(),
                        LandingProcessStep.builder().icon("ClipboardCheck")
                                .title("2. Évaluation IA")
                                .description("Notre IA évalue votre projet selon les critères pondérés du programme.").build(),
                        LandingProcessStep.builder().icon("Users")
                                .title("3. Entretien jury")
                                .description("Les meilleurs profils sont invités à pitcher devant un jury d'experts.").build(),
                        LandingProcessStep.builder().icon("Rocket")
                                .title("4. Accompagnement")
                                .description("Sélectionné ? Rejoignez le programme avec mentors, locaux et financements.").build()
                )))
                .testimonialsTitle("Ils nous font confiance")
                .testimonials(new ArrayList<>(List.of(
                        LandingTestimonial.builder()
                                .quote("Medianet Incubateur a transformé notre idée en produit en 6 mois. Le mentorat et la communauté valent de l'or.")
                                .authorName("Asma B.")
                                .authorRole("Cofondatrice, FoodStart").build(),
                        LandingTestimonial.builder()
                                .quote("Le matching avec les mentors est incroyablement pertinent. On a gagné 1 an de R&D.")
                                .authorName("Karim M.")
                                .authorRole("CEO, AgriTech Solutions").build(),
                        LandingTestimonial.builder()
                                .quote("Un programme structuré, des deadlines claires, des feedbacks rapides. Exactement ce qu'il faut pour avancer.")
                                .authorName("Yasmine T.")
                                .authorRole("Fondatrice, MedConnect").build()
                )))
                .faqTitle("Questions fréquentes")
                .faqs(new ArrayList<>(List.of(
                        LandingFaq.builder()
                                .question("Combien coûte la candidature ?")
                                .answer("La candidature est entièrement gratuite. Aucune commission n'est prélevée sur le capital de votre startup.").build(),
                        LandingFaq.builder()
                                .question("À quelle phase de projet puis-je candidater ?")
                                .answer("Du simple concept au prototype fonctionnel. Chaque programme précise sa maturité cible (idéation, prototypage, traction…).").build(),
                        LandingFaq.builder()
                                .question("Combien de temps dure un programme ?")
                                .answer("Selon le programme, entre 3 et 12 mois. Le détail est sur la page de chaque programme.").build(),
                        LandingFaq.builder()
                                .question("Qui sont les mentors ?")
                                .answer("Plus de 40 entrepreneurs, investisseurs et experts métiers actifs dans l'écosystème tunisien et nord-africain.").build()
                )))
                .build();
        return repository.save(p);
    }

    private LandingPageDto toDto(LandingPage p) {
        return LandingPageDto.builder()
                .heroTitle(p.getHeroTitle())
                .heroSubtitle(p.getHeroSubtitle())
                .heroBadge(p.getHeroBadge())
                .heroImageUrl(p.getHeroImageUrl())
                .primaryCtaLabel(p.getPrimaryCtaLabel())
                .primaryCtaLink(p.getPrimaryCtaLink())
                .secondaryCtaLabel(p.getSecondaryCtaLabel())
                .secondaryCtaLink(p.getSecondaryCtaLink())
                .stats(new ArrayList<>(p.getStats() != null ? p.getStats() : List.of()))
                .features(new ArrayList<>(p.getFeatures() != null ? p.getFeatures() : List.of()))
                .aboutBadge(p.getAboutBadge())
                .aboutTitle(p.getAboutTitle())
                .aboutBody(p.getAboutBody())
                .aboutImageUrl(p.getAboutImageUrl())
                .processTitle(p.getProcessTitle())
                .processSubtitle(p.getProcessSubtitle())
                .processSteps(new ArrayList<>(p.getProcessSteps() != null ? p.getProcessSteps() : List.of()))
                .testimonialsTitle(p.getTestimonialsTitle())
                .testimonials(new ArrayList<>(p.getTestimonials() != null ? p.getTestimonials() : List.of()))
                .faqTitle(p.getFaqTitle())
                .faqs(new ArrayList<>(p.getFaqs() != null ? p.getFaqs() : List.of()))
                .ctaTitle(p.getCtaTitle())
                .ctaSubtitle(p.getCtaSubtitle())
                .ctaButtonLabel(p.getCtaButtonLabel())
                .ctaButtonLink(p.getCtaButtonLink())
                .footerText(p.getFooterText())
                .primaryColor(p.getPrimaryColor())
                .accentColor(p.getAccentColor())
                .showHero(p.getShowHero())
                .showStats(p.getShowStats())
                .showAbout(p.getShowAbout())
                .showFeatures(p.getShowFeatures())
                .showProcess(p.getShowProcess())
                .showTestimonials(p.getShowTestimonials())
                .showFaq(p.getShowFaq())
                .showCta(p.getShowCta())
                .showProgrammes(p.getShowProgrammes())
                .programmesTitle(p.getProgrammesTitle())
                .programmesSubtitle(p.getProgrammesSubtitle())
                .programmesLimit(p.getProgrammesLimit())
                .sectionOrder(p.getSectionOrder())
                .build();
    }
}
