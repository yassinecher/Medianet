package com.medianet.programme.repository;

import com.medianet.programme.entity.ProgrammeCriteria;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProgrammeCriteriaRepository extends JpaRepository<ProgrammeCriteria, Long> {

    List<ProgrammeCriteria> findByProgrammeIdOrderByCriterionOrderAsc(Long programmeId);

    List<ProgrammeCriteria> findByProgrammeIdAndActiveTrue(Long programmeId);
}
