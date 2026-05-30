package com.medianet.programme.storage;

import io.minio.MinioClient;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * MinIO (S3-compatible) client configuration.
 *
 * <p>Two URLs are intentionally split:
 * <ul>
 *   <li><code>endpoint</code> — used internally by the container to upload/delete
 *       (e.g. {@code http://minio:9000}, Docker network DNS)</li>
 *   <li><code>publicUrl</code> — used to build the URL returned to the browser
 *       (e.g. {@code http://localhost:9000}, the host port mapping)</li>
 * </ul>
 */
@Configuration
@Getter
public class MinioConfig {

    @Value("${minio.endpoint:http://minio:9000}")
    private String endpoint;

    @Value("${minio.public-url:http://localhost:9000}")
    private String publicUrl;

    @Value("${minio.access-key:medianet}")
    private String accessKey;

    @Value("${minio.secret-key:medianet2024}")
    private String secretKey;

    @Value("${minio.bucket:medianet}")
    private String bucket;

    @Bean
    public MinioClient minioClient() {
        return MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
    }
}
