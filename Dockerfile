FROM golang:alpine AS builder
RUN apk add --no-cache git ca-certificates
WORKDIR /src
ADD go.mod go.sum ./
RUN go mod download
ADD . .
RUN go build -o /src/phat
# An /app the unprivileged user can write to, so Phat can create its
# directories with or without a volume mounted.
RUN mkdir -p /out/app/phat

FROM scratch
LABEL org.opencontainers.image.source=https://github.com/denmojo/phat
LABEL org.opencontainers.image.description="Phat - a Winlink client for amateur radio email, forked from Pat"
LABEL org.opencontainers.image.licenses=MIT
# Make sure we have a /tmp directory with the correct permissions (01777)
ADD .docker/tmp.tar /
COPY --from=builder /etc/ssl/certs /etc/ssl/certs
COPY --from=builder /src/phat /bin/phat
COPY --from=builder --chown=65534:65534 /out/app /app
USER 65534:65534
WORKDIR /app
ENV XDG_CONFIG_HOME=/app
ENV XDG_DATA_HOME=/app
ENV XDG_STATE_HOME=/app
# Listen on every interface, so the published port reaches the web client.
ENV PHAT_HTTPADDR=:8081
EXPOSE 8081
ENTRYPOINT ["/bin/phat"]
CMD ["http"]
