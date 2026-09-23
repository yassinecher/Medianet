package com.medianet.auth.repository;

import com.medianet.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);

    /** Find users that have a specific role (by role name string) */
    @Query("SELECT DISTINCT u FROM User u JOIN u.roles r WHERE r.name = :roleName")
    List<User> findByRoleName(@Param("roleName") String roleName);

    /** Invalidate every JWT issued so far for these users (see User.tokenVersion). */
    @Modifying
    @Query("UPDATE User u SET u.tokenVersion = COALESCE(u.tokenVersion, 0) + 1 WHERE u.id IN :ids")
    int bumpTokenVersion(@Param("ids") Collection<Long> ids);

    @Query("SELECT COALESCE(u.tokenVersion, 0) FROM User u WHERE u.id = :id")
    Optional<Integer> findTokenVersion(@Param("id") Long id);
}
