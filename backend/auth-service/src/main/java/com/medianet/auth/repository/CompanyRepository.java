package com.medianet.auth.repository;

import com.medianet.auth.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CompanyRepository extends JpaRepository<Company, Long> {

    /** All companies owned by a porteur (active only). */
    List<Company> findByPorteurIdAndActiveTrue(Long porteurId);

    /** All companies owned by a porteur (including inactive). */
    List<Company> findByPorteurId(Long porteurId);

    /** All active companies across all porteurs (admin use). */
    List<Company> findByActiveTrue();

    /** Active company by id — used when checking ownership. */
    Optional<Company> findByIdAndActiveTrue(Long id);

    /** Exists check — porteur already has a company with this name. */
    boolean existsByPorteurIdAndNameIgnoreCase(Long porteurId, String name);

    /** Companies by sector (public browse). */
    @Query("SELECT c FROM Company c WHERE c.active = true AND LOWER(c.sector) = LOWER(:sector)")
    List<Company> findBySectorIgnoreCase(@Param("sector") String sector);
}
