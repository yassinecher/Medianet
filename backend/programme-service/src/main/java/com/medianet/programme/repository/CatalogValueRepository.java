package com.medianet.programme.repository;

import com.medianet.programme.entity.CatalogValue;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CatalogValueRepository extends JpaRepository<CatalogValue, Long> {
    List<CatalogValue> findByCategoryOrderBySortOrderAscIdAsc(String category);
    boolean existsByCategoryAndValue(String category, String value);
    long countByCategory(String category);
}
