# Simplified Dockerfile for Librocco Development Container
# Strategy: Fast base image + install deps on first container creation
# Subsequent container starts reuse the installed deps (fast!)

FROM mcr.microsoft.com/devcontainers/typescript-node:1-20-bookworm

# Install git-lfs (required for repository)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        git-lfs \
    && rm -rf /var/lib/apt/lists/*

# Install Rush globally at the exact version used by the project
RUN npm install -g @microsoft/rush@5.102.0

# Set up non-root user
USER node

# Document exposed ports
EXPOSE 5173 3000 6006

CMD ["bash"]
