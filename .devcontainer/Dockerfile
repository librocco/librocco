# Librocco Development Container
#
# EXDEV Error Workaround:
# Rush's AsyncRecycler moves node_modules to common/temp/rush-recycler/ via rename().
# In BuildKit, different paths can land on different overlay mounts, and rename()
# fails across filesystem boundaries with "EXDEV: cross-device link not permitted".
#
# Failed fixes:
# - RUSH_TEMP_FOLDER: "not compatible with workspace installs"
# - No env var exists to disable the recycler
#
# Working fix: --mount=type=cache puts common/temp on a single filesystem where
# rename() succeeds. Multi-stage then extracts only /prebuilt-cache to final image.

# Stage 1: Build dependencies
FROM mcr.microsoft.com/devcontainers/typescript-node:1-20-bookworm AS builder

RUN npm install -g @microsoft/rush@5.102.0

WORKDIR /build
COPY --chown=node:node . .

# Cache mount avoids EXDEV; kill recycler and delete its folder before copying
RUN --mount=type=cache,target=/build/common/temp,uid=1000,gid=1000 \
    rush update --purge && \
    pkill -f rush-recycler || true && \
    rm -rf /build/common/temp/rush-recycler && \
    mkdir -p /prebuilt-cache && \
    cp -a /build/common/temp /prebuilt-cache/ && \
    cp /build/common/config/rush/pnpm-lock.yaml /prebuilt-cache/

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
