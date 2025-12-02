# Librocco Development Container
# Strategy: Multi-stage build with BuildKit cache mount to avoid EXDEV error
#
# The EXDEV problem: Rush's AsyncRecycler tries to rename() across overlay mounts,
# which fails in BuildKit. Using --mount=type=cache keeps common/temp on a single
# filesystem, avoiding the cross-device link issue.
#
# Multi-stage eliminates the /prebuilt directory from the final image entirely.

# Stage 1: Build dependencies
FROM mcr.microsoft.com/devcontainers/typescript-node:1-20-bookworm AS builder

# Install Rush globally at the exact version used by the project
RUN npm install -g @microsoft/rush@5.102.0

# Pre-build dependencies at staging location
WORKDIR /prebuilt
COPY --chown=node:node . .

# Use cache mount for common/temp to avoid EXDEV error with BuildKit
# Cache mount contents don't persist in final image, so copy to /prebuilt-cache/
# Use piped tar to handle rush-recycler deletion race while preserving permissions
RUN --mount=type=cache,target=/prebuilt/common/temp,uid=1000,gid=1000 \
    rush update --purge && \
    mkdir -p /prebuilt-cache && \
    tar --exclude='rush-recycler' --warning=no-file-changed -C /prebuilt/common -cf - temp | tar -C /prebuilt-cache -xf - && \
    cp /prebuilt/common/config/rush/pnpm-lock.yaml /prebuilt-cache/ && \
    chown -R node:node /prebuilt-cache

# Stage 2: Final image - clean slate, no /prebuilt directory
FROM mcr.microsoft.com/devcontainers/typescript-node:1-20-bookworm

# Install git-lfs (required for repository)
RUN apt-get update && \
    apt-get install -y --no-install-recommends git-lfs && \
    rm -rf /var/lib/apt/lists/*

# Install Rush globally at the exact version used by the project
RUN npm install -g @microsoft/rush@5.102.0

# Copy only the prebuilt cache from builder stage
COPY --from=builder --chown=node:node /prebuilt-cache /prebuilt-cache

USER node

# Document exposed ports
EXPOSE 5173 3000 6006

CMD ["bash"]
