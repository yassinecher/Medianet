package com.medianet.programme.storage;

/**
 * A pasted image link could not be imported. The message is user-facing (French).
 *
 * <p>{@code remoteRefused} = the link looked fine but the remote site refused or
 * failed to serve it to our server (403, timeout, 5xx…). Those are answered 422
 * and the frontends may still try the link directly in the browser; anything else
 * (not an image, internal address, too large) is a plain 400.
 */
public class RemoteImageException extends IllegalArgumentException {

    private final boolean remoteRefused;

    public RemoteImageException(String message) {
        this(message, false);
    }

    public RemoteImageException(String message, boolean remoteRefused) {
        super(message);
        this.remoteRefused = remoteRefused;
    }

    public boolean isRemoteRefused() {
        return remoteRefused;
    }
}
