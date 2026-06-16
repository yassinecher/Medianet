package com.medianet.notification.repository;

import com.medianet.notification.entity.ContactGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContactGroupRepository extends JpaRepository<ContactGroup, Long> {
    List<ContactGroup> findAllByOrderByNameAsc();
}
