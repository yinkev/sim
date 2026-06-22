{{/*
Expand the name of the chart.
*/}}
{{- define "sim.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "sim.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "sim.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "sim.labels" -}}
helm.sh/chart: {{ include "sim.chart" . }}
{{ include "sim.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- with .Values.global.commonLabels }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "sim.selectorLabels" -}}
app.kubernetes.io/name: {{ include "sim.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
App specific labels
*/}}
{{- define "sim.app.labels" -}}
{{ include "sim.labels" . }}
app.kubernetes.io/component: app
{{- end }}

{{/*
App selector labels
*/}}
{{- define "sim.app.selectorLabels" -}}
{{ include "sim.selectorLabels" . }}
app.kubernetes.io/component: app
{{- end }}

{{/*
Realtime specific labels
*/}}
{{- define "sim.realtime.labels" -}}
{{ include "sim.labels" . }}
app.kubernetes.io/component: realtime
{{- end }}

{{/*
Realtime selector labels
*/}}
{{- define "sim.realtime.selectorLabels" -}}
{{ include "sim.selectorLabels" . }}
app.kubernetes.io/component: realtime
{{- end }}

{{/*
Mothership specific labels
*/}}
{{- define "sim.mothership.labels" -}}
{{ include "sim.labels" . }}
app.kubernetes.io/component: mothership
{{- end }}

{{/*
Mothership selector labels
*/}}
{{- define "sim.mothership.selectorLabels" -}}
{{ include "sim.selectorLabels" . }}
app.kubernetes.io/component: mothership
{{- end }}

{{/*
Mothership billing processor labels
*/}}
{{- define "sim.mothership.processor.labels" -}}
{{ include "sim.labels" . }}
app.kubernetes.io/component: mothership-billing-processor
simstudio.ai/component-group: mothership-processor
{{- end }}

{{/*
Mothership billing processor selector labels
*/}}
{{- define "sim.mothership.processor.selectorLabels" -}}
{{ include "sim.selectorLabels" . }}
app.kubernetes.io/component: mothership-billing-processor
simstudio.ai/component-group: mothership-processor
{{- end }}

{{/*
PostgreSQL specific labels
*/}}
{{- define "sim.postgresql.labels" -}}
{{ include "sim.labels" . }}
app.kubernetes.io/component: postgresql
{{- end }}

{{/*
PostgreSQL selector labels
*/}}
{{- define "sim.postgresql.selectorLabels" -}}
{{ include "sim.selectorLabels" . }}
app.kubernetes.io/component: postgresql
{{- end }}

{{/*
Ollama specific labels
*/}}
{{- define "sim.ollama.labels" -}}
{{ include "sim.labels" . }}
app.kubernetes.io/component: ollama
{{- end }}

{{/*
Ollama selector labels
*/}}
{{- define "sim.ollama.selectorLabels" -}}
{{ include "sim.selectorLabels" . }}
app.kubernetes.io/component: ollama
{{- end }}

{{/*
Migrations specific labels
*/}}
{{- define "sim.migrations.labels" -}}
{{ include "sim.labels" . }}
app.kubernetes.io/component: migrations
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "sim.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "sim.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create image name with optional registry and digest pinning.
Accepts a context dict with:
  imageRoot       — the image object (repository, optional tag, optional digest, pullPolicy)
  global          — .Values.global (for imageRegistry and useRegistryForAllImages)
  chartAppVersion — .Chart.AppVersion (used as default tag when imageRoot.tag is empty)

Resolution order:
  1. If imageRoot.digest is set, render "<registry?/>repo@<digest>"
  2. Else render "<registry?/>repo:<tag>" where tag defaults to chartAppVersion
Usage: {{ include "sim.image" (dict "imageRoot" .Values.app.image "global" .Values.global "chartAppVersion" .Chart.AppVersion) }}
*/}}
{{- define "sim.image" -}}
{{- $imageRoot := .imageRoot -}}
{{- $global := .global -}}
{{- $repository := $imageRoot.repository -}}
{{- $digest := $imageRoot.digest | default "" -}}
{{- $tag := $imageRoot.tag | default "" | toString -}}
{{- if and (eq $tag "") (eq $digest "") -}}
  {{- $tag = .chartAppVersion | default "" | toString -}}
{{- end -}}
{{- $registry := "" -}}
{{- if and $global $global.imageRegistry -}}
  {{- if or (hasPrefix "simstudioai/" $repository) $global.useRegistryForAllImages -}}
    {{- $registry = $global.imageRegistry -}}
  {{- end -}}
{{- end -}}
{{- $repoPath := $repository -}}
{{- if $registry -}}
  {{- $repoPath = printf "%s/%s" $registry $repository -}}
{{- end -}}
{{- if ne $digest "" -}}
{{- printf "%s@%s" $repoPath $digest }}
{{- else -}}
{{- $resolvedTag := required (printf "sim.image: no tag or digest resolvable for %q (set imageRoot.tag, imageRoot.digest, or Chart.AppVersion)" $repository) $tag -}}
{{- printf "%s:%s" $repoPath $resolvedTag }}
{{- end -}}
{{- end }}

{{/*
Internal Mothership URL
*/}}
{{- define "sim.mothership.internalUrl" -}}
{{- printf "http://%s-mothership:%v" (include "sim.fullname" .) .Values.mothership.server.service.port -}}
{{- end }}

{{/*
Database URL for internal PostgreSQL
*/}}
{{- define "sim.databaseUrl" -}}
{{- if .Values.postgresql.enabled }}
{{- $host := printf "%s-postgresql" (include "sim.fullname" .) }}
{{- $port := .Values.postgresql.service.port }}
{{- $username := .Values.postgresql.auth.username }}
{{- $database := .Values.postgresql.auth.database }}
{{- $sslMode := ternary "require" "disable" .Values.postgresql.tls.enabled }}
{{- printf "postgresql://%s:$(POSTGRES_PASSWORD)@%s:%v/%s?sslmode=%s" $username $host $port $database $sslMode }}
{{- else if .Values.externalDatabase.enabled }}
{{- $host := .Values.externalDatabase.host }}
{{- $port := .Values.externalDatabase.port }}
{{- $username := .Values.externalDatabase.username }}
{{- $database := .Values.externalDatabase.database }}
{{- $sslMode := .Values.externalDatabase.sslMode }}
{{- printf "postgresql://%s:$(EXTERNAL_DB_PASSWORD)@%s:%v/%s?sslmode=%s" $username $host $port $database $sslMode }}
{{- end }}
{{- end }}

{{/*
Validate required secrets and reject default placeholder values
Skip validation when using existing secrets or External Secrets Operator
*/}}
{{- define "sim.validateSecrets" -}}
{{- $useExistingAppSecret := and .Values.app.secrets .Values.app.secrets.existingSecret .Values.app.secrets.existingSecret.enabled }}
{{- $useExternalSecrets := and .Values.externalSecrets .Values.externalSecrets.enabled }}
{{- $useExistingPostgresSecret := and .Values.postgresql.auth.existingSecret .Values.postgresql.auth.existingSecret.enabled }}
{{- $useExistingExternalDbSecret := and .Values.externalDatabase.existingSecret .Values.externalDatabase.existingSecret.enabled }}
{{- $appEnv := default (dict) .Values.app.env }}
{{- $mothershipEnabled := and .Values.mothership .Values.mothership.enabled }}
{{- $mothershipRuntimeConfigured := or $mothershipEnabled (and .Values.copilot .Values.copilot.enabled) (index $appEnv "SIM_AGENT_API_URL") (index $appEnv "COPILOT_DEV_URL") (index $appEnv "COPILOT_STAGING_URL") (index $appEnv "COPILOT_PROD_URL") (index $appEnv "COPILOT_API_KEY") }}
{{- if and .Values.mothership.processor.billingCallbacks.enabled (not $mothershipEnabled) }}
{{- fail "mothership.processor.billingCallbacks.enabled requires mothership.enabled=true" }}
{{- end }}
{{- /* App secrets validation - skip if using existing secret or ESO */ -}}
{{- if not (or $useExistingAppSecret $useExternalSecrets) }}
{{- if and .Values.app.enabled (not .Values.app.env.BETTER_AUTH_SECRET) }}
{{- fail "app.env.BETTER_AUTH_SECRET is required for production deployment" }}
{{- end }}
{{- if and .Values.app.enabled (eq .Values.app.env.BETTER_AUTH_SECRET "CHANGE-ME-32-CHAR-SECRET-FOR-PRODUCTION-USE") }}
{{- fail "app.env.BETTER_AUTH_SECRET must not use the default placeholder value. Generate a secure secret with: openssl rand -hex 32" }}
{{- end }}
{{- if and .Values.app.enabled (not .Values.app.env.ENCRYPTION_KEY) }}
{{- fail "app.env.ENCRYPTION_KEY is required for production deployment" }}
{{- end }}
{{- if and .Values.app.enabled (eq .Values.app.env.ENCRYPTION_KEY "CHANGE-ME-32-CHAR-ENCRYPTION-KEY-FOR-PROD") }}
{{- fail "app.env.ENCRYPTION_KEY must not use the default placeholder value. Generate a secure key with: openssl rand -hex 32" }}
{{- end }}
{{- if and .Values.app.enabled (not .Values.app.env.INTERNAL_API_SECRET) }}
{{- fail "app.env.INTERNAL_API_SECRET is required for production deployment (shared auth between sim-app and sim-realtime pods). Generate one with: openssl rand -hex 32" }}
{{- end }}
{{- if and .Values.app.enabled $mothershipRuntimeConfigured (not .Values.app.env.SIM_TO_MOTHERSHIP_API_KEY) }}
{{- fail "app.env.SIM_TO_MOTHERSHIP_API_KEY is required when Mothership/Copilot runtime is configured (authenticates Sim-to-Mothership runtime calls). Generate one with: openssl rand -hex 32" }}
{{- end }}
{{- if and .Values.app.enabled (not .Values.app.env.MOTHERSHIP_TO_SIM_CALLBACK_KEY) }}
{{- fail "app.env.MOTHERSHIP_TO_SIM_CALLBACK_KEY is required for production deployment (authenticates Mothership-to-Sim callback routes). Generate one with: openssl rand -hex 32" }}
{{- end }}
{{- if and .Values.app.enabled $mothershipEnabled (not .Values.app.env.MOTHERSHIP_ADMIN_API_KEY) }}
{{- fail "app.env.MOTHERSHIP_ADMIN_API_KEY is required when mothership.enabled=true (authenticates owned Mothership admin routes). Generate one with: openssl rand -hex 32" }}
{{- end }}
{{- if and .Values.app.enabled $mothershipEnabled (not .Values.app.env.API_ENCRYPTION_KEY) }}
{{- fail "app.env.API_ENCRYPTION_KEY is required when mothership.enabled=true (apps/mothership uses it for API-key storage). Generate one with: openssl rand -hex 32" }}
{{- end }}
{{- if and .Values.realtime.enabled (eq .Values.realtime.env.BETTER_AUTH_SECRET "CHANGE-ME-32-CHAR-SECRET-FOR-PRODUCTION-USE") }}
{{- fail "realtime.env.BETTER_AUTH_SECRET must not use the default placeholder value. Generate a secure secret with: openssl rand -hex 32" }}
{{- end }}
{{- /* CRON_SECRET is required when cronjobs are enabled — pods reference it via secretKeyRef and would fail to start if the key is missing from the Secret. */ -}}
{{- if and .Values.cronjobs.enabled (not .Values.app.env.CRON_SECRET) }}
{{- fail "app.env.CRON_SECRET is required when cronjobs.enabled=true (every cron pod authenticates with this token). Generate one with: openssl rand -hex 32, or set cronjobs.enabled=false." }}
{{- end }}
{{- end }}
{{- /* PostgreSQL password validation - skip if using existing secret or ESO */ -}}
{{- if not (or $useExistingPostgresSecret $useExternalSecrets) }}
{{- if and .Values.postgresql.enabled (not .Values.postgresql.auth.password) }}
{{- fail "postgresql.auth.password is required when using internal PostgreSQL" }}
{{- end }}
{{- if and .Values.postgresql.enabled (eq .Values.postgresql.auth.password "CHANGE-ME-SECURE-PASSWORD") }}
{{- fail "postgresql.auth.password must not use the default placeholder value. Set a secure password for production" }}
{{- end }}
{{- if and .Values.postgresql.enabled .Values.postgresql.auth.password (not (regexMatch "^[a-zA-Z0-9._-]+$" .Values.postgresql.auth.password)) }}
{{- fail "postgresql.auth.password must only contain alphanumeric characters, hyphens, underscores, or periods to ensure DATABASE_URL compatibility. Generate with: openssl rand -base64 16 | tr -d '/+='" }}
{{- end }}
{{- end }}
{{- /* External database password validation - skip if using existing secret or ESO */ -}}
{{- if not (or $useExistingExternalDbSecret $useExternalSecrets) }}
{{- if and .Values.externalDatabase.enabled (not .Values.externalDatabase.password) }}
{{- fail "externalDatabase.password is required when using external database" }}
{{- end }}
{{- if and .Values.externalDatabase.enabled .Values.externalDatabase.password (not (regexMatch "^[a-zA-Z0-9._-]+$" .Values.externalDatabase.password)) }}
{{- fail "externalDatabase.password must only contain alphanumeric characters, hyphens, underscores, or periods to ensure DATABASE_URL compatibility." }}
{{- end }}
{{- end }}
{{- /* ESO coverage validation - every key set in app.env / realtime.env must be mapped in externalSecrets.remoteRefs.app */ -}}
{{- include "sim.validateExternalSecretCoverage" . }}
{{- end }}

{{/*
Validate that every key set in app.env / realtime.env is also mapped in
externalSecrets.remoteRefs.app when ESO is enabled. When ESO is on, the
chart-managed Secret is not rendered — anything not mapped via ESO would
be silently missing at runtime.

Chart-computed keys (DATABASE_URL, SOCKET_SERVER_URL, OLLAMA_URL) are
exempt because they're inlined on the container, not sourced from the
Secret.

Fail-fast is only safe for ESO because we can introspect remoteRefs at
template time. For existingSecret we cannot read the user's pre-created
Secret, so coverage there is documented (values.yaml + README) rather
than enforced.
*/}}
{{- define "sim.validateExternalSecretCoverage" -}}
{{- if and .Values.externalSecrets .Values.externalSecrets.enabled -}}
{{- $remoteRefs := default (dict) (default (dict) .Values.externalSecrets.remoteRefs).app -}}
{{- $chartComputed := list "DATABASE_URL" "SOCKET_SERVER_URL" "OLLAMA_URL" -}}
{{- $appEnv := default (dict) .Values.app.env -}}
{{- $mothershipEnabled := and .Values.mothership .Values.mothership.enabled -}}
{{- $mothershipRuntimeConfigured := or $mothershipEnabled (and .Values.copilot .Values.copilot.enabled) (index $appEnv "SIM_AGENT_API_URL") (index $appEnv "COPILOT_DEV_URL") (index $appEnv "COPILOT_STAGING_URL") (index $appEnv "COPILOT_PROD_URL") (index $appEnv "COPILOT_API_KEY") -}}
{{/*
  Required-key coverage: these are non-optional at runtime. With ESO enabled
  the chart-managed Secret is not rendered, so a missing key surfaces as a
  runtime CrashLoopBackOff with cryptic env errors. Fail at template time
  if the key is neither set in app.env nor mapped via remoteRefs.app.
*/}}
{{- if .Values.app.enabled -}}
{{- $required := list "BETTER_AUTH_SECRET" "ENCRYPTION_KEY" "INTERNAL_API_SECRET" "MOTHERSHIP_TO_SIM_CALLBACK_KEY" -}}
{{- if $mothershipRuntimeConfigured -}}
{{- $required = append $required "SIM_TO_MOTHERSHIP_API_KEY" -}}
{{- end -}}
{{- if $mothershipEnabled -}}
{{- $required = append $required "MOTHERSHIP_ADMIN_API_KEY" -}}
{{- $required = append $required "API_ENCRYPTION_KEY" -}}
{{- end -}}
{{- if .Values.cronjobs.enabled -}}
{{- $required = append $required "CRON_SECRET" -}}
{{- end -}}
{{- range $key := $required -}}
{{- $inEnv := index $appEnv $key -}}
{{- $mapped := index $remoteRefs $key -}}
{{- if and (or (not $inEnv) (eq (toString $inEnv) "") (eq (toString $inEnv) "<nil>")) (not $mapped) -}}
{{- fail (printf "Required key '%s' is missing: externalSecrets.enabled=true but the key is neither set in app.env nor mapped in externalSecrets.remoteRefs.app. Map it via externalSecrets.remoteRefs.app.%s='path/in/store' so it is synced into the app Secret." $key $key) }}
{{- end -}}
{{- end -}}
{{- end -}}
{{- if .Values.app.enabled -}}
{{- range $key, $value := default (dict) .Values.app.env -}}
{{- if not (has $key $chartComputed) -}}
{{- if and (ne (toString $value) "") (ne (toString $value) "<nil>") -}}
{{- $mapped := index $remoteRefs $key -}}
{{- if not $mapped -}}
{{- fail (printf "Key '%s' is set in app.env but externalSecrets.enabled=true and externalSecrets.remoteRefs.app.%s is not configured. When ESO is enabled the chart-managed app Secret is not rendered, so the container would start with no value. Either map it via externalSecrets.remoteRefs.app.%s='path/in/store' or remove it from app.env." $key $key $key) }}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- if .Values.realtime.enabled -}}
{{- range $key, $value := default (dict) .Values.realtime.env -}}
{{- if not (has $key $chartComputed) -}}
{{- if and (ne (toString $value) "") (ne (toString $value) "<nil>") -}}
{{- $mapped := index $remoteRefs $key -}}
{{- if not $mapped -}}
{{- fail (printf "Key '%s' is set in realtime.env but externalSecrets.enabled=true and externalSecrets.remoteRefs.app.%s is not configured. Either map it via externalSecrets.remoteRefs.app.%s='path/in/store' or remove it from realtime.env." $key $key $key) }}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end }}

{{/*
Get the app secrets name
Returns the name of the secret containing app credentials (auth, encryption keys)
*/}}
{{- define "sim.appSecretName" -}}
{{- if and .Values.app.secrets .Values.app.secrets.existingSecret .Values.app.secrets.existingSecret.enabled (not .Values.externalSecrets.enabled) -}}
{{- .Values.app.secrets.existingSecret.name -}}
{{- else -}}
{{- printf "%s-app-secrets" (include "sim.fullname" .) -}}
{{- end -}}
{{- end }}

{{/*
Get the PostgreSQL secret name
Returns the name of the secret containing PostgreSQL password
*/}}
{{- define "sim.postgresqlSecretName" -}}
{{- if and .Values.postgresql.auth.existingSecret .Values.postgresql.auth.existingSecret.enabled (not .Values.externalSecrets.enabled) -}}
{{- .Values.postgresql.auth.existingSecret.name -}}
{{- else -}}
{{- printf "%s-postgresql-secret" (include "sim.fullname" .) -}}
{{- end -}}
{{- end }}

{{/*
Get the PostgreSQL password key name
Returns the key name in the secret that contains the password
*/}}
{{- define "sim.postgresqlPasswordKey" -}}
{{- if and .Values.postgresql.auth.existingSecret .Values.postgresql.auth.existingSecret.enabled (not .Values.externalSecrets.enabled) -}}
{{- .Values.postgresql.auth.existingSecret.passwordKey | default "POSTGRES_PASSWORD" -}}
{{- else -}}
{{- print "POSTGRES_PASSWORD" -}}
{{- end -}}
{{- end }}

{{/*
Get the external database secret name
Returns the name of the secret containing external database password
*/}}
{{- define "sim.externalDbSecretName" -}}
{{- if and .Values.externalDatabase.existingSecret .Values.externalDatabase.existingSecret.enabled (not .Values.externalSecrets.enabled) -}}
{{- .Values.externalDatabase.existingSecret.name -}}
{{- else -}}
{{- printf "%s-external-db-secret" (include "sim.fullname" .) -}}
{{- end -}}
{{- end }}

{{/*
Get the external database password key name
Returns the key name in the secret that contains the password
*/}}
{{- define "sim.externalDbPasswordKey" -}}
{{- if and .Values.externalDatabase.existingSecret .Values.externalDatabase.existingSecret.enabled (not .Values.externalSecrets.enabled) -}}
{{- .Values.externalDatabase.existingSecret.passwordKey | default "EXTERNAL_DB_PASSWORD" -}}
{{- else -}}
{{- print "EXTERNAL_DB_PASSWORD" -}}
{{- end -}}
{{- end }}

{{/*
App existingSecret explicit env vars
*/}}
{{- define "sim.appExistingSecretEnvVars" -}}
{{- $root := .root -}}
{{- $keys := .keys -}}
{{- if and $root.Values.app.secrets.existingSecret.enabled (not $root.Values.externalSecrets.enabled) -}}
{{- $appEnv := default (dict) $root.Values.app.env -}}
{{- $keyMap := default (dict) $root.Values.app.secrets.existingSecret.keys -}}
{{- range $envName := $keys -}}
{{- $secretKey := default $envName (index $keyMap $envName) -}}
{{- $inline := index $appEnv $envName -}}
{{- if and $secretKey (ne (toString $secretKey) "") (or (not $inline) (eq (toString $inline) "") (eq (toString $inline) "<nil>")) }}
- name: {{ $envName }}
  valueFrom:
    secretKeyRef:
      name: {{ include "sim.appSecretName" $root }}
      key: {{ $secretKey }}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end }}

{{/*
App Secret explicit env vars
*/}}
{{- define "sim.appSecretEnvVars" -}}
{{- $root := .root -}}
{{- $keys := .keys -}}
{{- $keyMap := default (dict) $root.Values.app.secrets.existingSecret.keys -}}
{{- $useExistingSecret := and $root.Values.app.secrets.existingSecret.enabled (not $root.Values.externalSecrets.enabled) -}}
{{- range $envName := $keys -}}
{{- $secretKey := $envName -}}
{{- if $useExistingSecret -}}
{{- $secretKey = default $envName (index $keyMap $envName) -}}
{{- end }}
- name: {{ $envName }}
  valueFrom:
    secretKeyRef:
      name: {{ include "sim.appSecretName" $root }}
      key: {{ $secretKey }}
{{- end -}}
{{- end }}

{{/*
Database Secret explicit env vars
*/}}
{{- define "sim.databaseSecretEnvVars" -}}
{{- if .Values.postgresql.enabled }}
- name: POSTGRES_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "sim.postgresqlSecretName" . }}
      key: {{ include "sim.postgresqlPasswordKey" . }}
{{- else if .Values.externalDatabase.enabled }}
- name: EXTERNAL_DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "sim.externalDbSecretName" . }}
      key: {{ include "sim.externalDbPasswordKey" . }}
{{- end -}}
{{- end }}

{{/*
Database existingSecret explicit env vars
*/}}
{{- define "sim.databaseExistingSecretEnvVars" -}}
{{- if and (not .Values.externalSecrets.enabled) (or (and .Values.postgresql.enabled .Values.postgresql.auth.existingSecret .Values.postgresql.auth.existingSecret.enabled) (and .Values.externalDatabase.enabled .Values.externalDatabase.existingSecret .Values.externalDatabase.existingSecret.enabled)) -}}
{{- include "sim.databaseSecretEnvVars" . }}
{{- end -}}
{{- end }}

{{/*
Check if app secrets should be created by the chart
Returns true if we should create the app secrets (not using existing or ESO)
*/}}
{{- define "sim.createAppSecrets" -}}
{{- $useExistingAppSecret := and .Values.app.secrets .Values.app.secrets.existingSecret .Values.app.secrets.existingSecret.enabled }}
{{- $useExternalSecrets := and .Values.externalSecrets .Values.externalSecrets.enabled }}
{{- if not (or $useExistingAppSecret $useExternalSecrets) -}}
true
{{- end -}}
{{- end }}

{{/*
Check if PostgreSQL secret should be created by the chart
Returns true if we should create the PostgreSQL secret (not using existing or ESO)
*/}}
{{- define "sim.createPostgresqlSecret" -}}
{{- $useExistingSecret := and .Values.postgresql.auth.existingSecret .Values.postgresql.auth.existingSecret.enabled }}
{{- $useExternalSecrets := and .Values.externalSecrets .Values.externalSecrets.enabled }}
{{- if not (or $useExistingSecret $useExternalSecrets) -}}
true
{{- end -}}
{{- end }}

{{/*
Check if external database secret should be created by the chart
Returns true if we should create the external database secret (not using existing or ESO)
*/}}
{{- define "sim.createExternalDbSecret" -}}
{{- $useExistingSecret := and .Values.externalDatabase.existingSecret .Values.externalDatabase.existingSecret.enabled }}
{{- $useExternalSecrets := and .Values.externalSecrets .Values.externalSecrets.enabled }}
{{- if not (or $useExistingSecret $useExternalSecrets) -}}
true
{{- end -}}
{{- end }}

{{/*
Ollama URL
*/}}
{{- define "sim.ollamaUrl" -}}
{{- if .Values.ollama.enabled }}
{{- $serviceName := printf "%s-ollama" (include "sim.fullname" .) }}
{{- $port := .Values.ollama.service.port }}
{{- printf "http://%s:%v" $serviceName $port }}
{{- else }}
{{- .Values.app.env.OLLAMA_URL | default "http://localhost:11434" }}
{{- end }}
{{- end }}

{{/*
Socket Server URL (internal)
*/}}
{{- define "sim.socketServerUrl" -}}
{{- if .Values.realtime.enabled }}
{{- $serviceName := printf "%s-realtime" (include "sim.fullname" .) }}
{{- $port := .Values.realtime.service.port }}
{{- printf "http://%s:%v" $serviceName $port }}
{{- else }}
{{- .Values.app.env.SOCKET_SERVER_URL | default "http://localhost:3002" }}
{{- end }}
{{- end }}

{{/*
Resource limits and requests
*/}}
{{- define "sim.resources" -}}
{{- if .resources }}
resources:
  {{- if .resources.limits }}
  limits:
    {{- toYaml .resources.limits | nindent 4 }}
  {{- end }}
  {{- if .resources.requests }}
  requests:
    {{- toYaml .resources.requests | nindent 4 }}
  {{- end }}
{{- end }}
{{- end }}

{{/*
Pod-level security context with Pod Security Standards "restricted" defaults.
User-supplied `.podSecurityContext` values override defaults (user wins).
Usage: {{ include "sim.podSecurityContext" .Values.app | nindent 6 }}
*/}}
{{- define "sim.podSecurityContext" -}}
{{- $defaults := dict "runAsNonRoot" true "runAsUser" 1001 "runAsGroup" 1001 "fsGroup" 1001 "seccompProfile" (dict "type" "RuntimeDefault") -}}
{{- $user := default (dict) .podSecurityContext -}}
{{- $merged := mergeOverwrite (deepCopy $defaults) $user -}}
securityContext:
  {{- toYaml $merged | nindent 2 }}
{{- end }}

{{/*
Container-level security context with Pod Security Standards "restricted" defaults.
User-supplied `.securityContext` values override defaults (user wins).
`readOnlyRootFilesystem` is intentionally NOT defaulted — set it per-workload in values
when the container can tolerate a read-only root (Next.js writes to `.next/cache`,
Postgres writes to `/var/lib/postgresql/data`, so they're left writable by default).
Usage: {{ include "sim.containerSecurityContext" .Values.app | nindent 10 }}
*/}}
{{- define "sim.containerSecurityContext" -}}
{{- $defaults := dict "runAsNonRoot" true "allowPrivilegeEscalation" false "capabilities" (dict "drop" (list "ALL")) "seccompProfile" (dict "type" "RuntimeDefault") -}}
{{- $user := default (dict) .securityContext -}}
{{- $merged := mergeOverwrite (deepCopy $defaults) $user -}}
securityContext:
  {{- toYaml $merged | nindent 2 }}
{{- end }}

{{/*
Backwards-compatible alias for container security context.
*/}}
{{- define "sim.securityContext" -}}
{{- include "sim.containerSecurityContext" . }}
{{- end }}

{{/*
Node selector
*/}}
{{- define "sim.nodeSelector" -}}
{{- if .nodeSelector }}
nodeSelector:
  {{- toYaml .nodeSelector | nindent 2 }}
{{- end }}
{{- end }}

{{/*
Tolerations
*/}}
{{- define "sim.tolerations" -}}
{{- if .tolerations }}
tolerations:
  {{- toYaml .tolerations | nindent 2 }}
{{- end }}
{{- end }}

{{/*
Affinity
*/}}
{{- define "sim.affinity" -}}
{{- if .affinity }}
affinity:
  {{- toYaml .affinity | nindent 2 }}
{{- end }}
{{- end }}

{{/*
Topology spread constraints — spreads pods across failure domains.
Pass the per-component spec (.Values.app, .Values.realtime, ...). Users supply
the full constraint list including labelSelector; pattern mirrors affinity.
Usage: {{ include "sim.topologySpreadConstraints" .Values.app | nindent 6 }}
*/}}
{{- define "sim.topologySpreadConstraints" -}}
{{- if .topologySpreadConstraints }}
topologySpreadConstraints:
  {{- toYaml .topologySpreadConstraints | nindent 2 }}
{{- end }}
{{- end }}

{{/*
Mothership environment secret name
*/}}
{{- define "sim.mothership.envSecretName" -}}
{{- if and .Values.mothership.server.secret.name (ne .Values.mothership.server.secret.name "") -}}
{{- .Values.mothership.server.secret.name -}}
{{- else -}}
{{- printf "%s-mothership-env" (include "sim.fullname" .) -}}
{{- end -}}
{{- end }}

{{/*
Validate owned Mothership configuration
*/}}
{{- define "sim.mothership.validate" -}}
{{- if .Values.mothership.enabled -}}
  {{- $appEnv := default (dict) .Values.app.env -}}
  {{- $realtimeEnv := default (dict) .Values.realtime.env -}}
  {{- $mothershipEnv := default (dict) .Values.mothership.server.env -}}
  {{- $appRemoteRefs := default (dict) (default (dict) .Values.externalSecrets.remoteRefs).app -}}
  {{- $mothershipRemoteRefs := default (dict) (default (dict) .Values.externalSecrets.remoteRefs).mothership -}}
  {{- $mothershipOnlyKeys := list "SIM_BASE_URL" "MOTHERSHIP_ANTHROPIC_API_KEY" "MOTHERSHIP_OPENAI_API_KEY" "MOTHERSHIP_AVAILABLE_MODELS_JSON" -}}
  {{- $sharedBoundaryKeys := list "SIM_TO_MOTHERSHIP_API_KEY" "MOTHERSHIP_TO_SIM_CALLBACK_KEY" "MOTHERSHIP_ADMIN_API_KEY" "ENCRYPTION_KEY" "API_ENCRYPTION_KEY" -}}
  {{- $useExistingAppSecret := and .Values.app.secrets .Values.app.secrets.existingSecret .Values.app.secrets.existingSecret.enabled -}}
  {{- if and $useExistingAppSecret (not .Values.externalSecrets.enabled) (or (not .Values.app.secrets.existingSecret.name) (eq .Values.app.secrets.existingSecret.name "")) -}}
    {{- fail "app.secrets.existingSecret.name is required when app.secrets.existingSecret.enabled=true" -}}
  {{- end -}}
  {{- if and .Values.postgresql.enabled .Values.postgresql.auth.existingSecret .Values.postgresql.auth.existingSecret.enabled (not .Values.externalSecrets.enabled) (or (not .Values.postgresql.auth.existingSecret.name) (eq .Values.postgresql.auth.existingSecret.name "")) -}}
    {{- fail "postgresql.auth.existingSecret.name is required when postgresql.auth.existingSecret.enabled=true" -}}
  {{- end -}}
  {{- if and .Values.externalDatabase.enabled .Values.externalDatabase.existingSecret .Values.externalDatabase.existingSecret.enabled (not .Values.externalSecrets.enabled) (or (not .Values.externalDatabase.existingSecret.name) (eq .Values.externalDatabase.existingSecret.name "")) -}}
    {{- fail "externalDatabase.existingSecret.name is required when externalDatabase.existingSecret.enabled=true" -}}
  {{- end -}}
  {{- range $key := $mothershipOnlyKeys -}}
    {{- $appValue := index $appEnv $key -}}
    {{- if and $appValue (ne (toString $appValue) "") (ne (toString $appValue) "<nil>") -}}
      {{- fail (printf "app.env.%s is Mothership-only; move it to mothership.server.env.%s" $key $key) -}}
    {{- end -}}
    {{- $realtimeValue := index $realtimeEnv $key -}}
    {{- if and $realtimeValue (ne (toString $realtimeValue) "") (ne (toString $realtimeValue) "<nil>") -}}
      {{- fail (printf "realtime.env.%s is Mothership-only; move it to mothership.server.env.%s" $key $key) -}}
    {{- end -}}
    {{- if and (index $appRemoteRefs $key) (ne (toString (index $appRemoteRefs $key)) "") (ne (toString (index $appRemoteRefs $key)) "<nil>") -}}
      {{- fail (printf "externalSecrets.remoteRefs.app.%s is Mothership-only; move it to externalSecrets.remoteRefs.mothership.%s" $key $key) -}}
    {{- end -}}
  {{- end -}}
  {{- range $key := $sharedBoundaryKeys -}}
    {{- $mothershipValue := index $mothershipEnv $key -}}
    {{- if and $mothershipValue (ne (toString $mothershipValue) "") (ne (toString $mothershipValue) "<nil>") -}}
      {{- fail (printf "mothership.server.env.%s is a shared boundary secret; keep it in app.env.%s so Sim and Mothership use one value" $key $key) -}}
    {{- end -}}
    {{- if and (index $mothershipRemoteRefs $key) (ne (toString (index $mothershipRemoteRefs $key)) "") (ne (toString (index $mothershipRemoteRefs $key)) "<nil>") -}}
      {{- fail (printf "externalSecrets.remoteRefs.mothership.%s is a shared boundary secret; keep it in externalSecrets.remoteRefs.app.%s" $key $key) -}}
    {{- end -}}
  {{- end -}}
  {{- range $item := default (list) .Values.extraEnvVars -}}
    {{- $name := index $item "name" -}}
    {{- if has $name $mothershipOnlyKeys -}}
      {{- fail (printf "extraEnvVars[%s] is Mothership-only; move it to mothership.server.env.%s" $name $name) -}}
    {{- end -}}
  {{- end -}}
  {{- range $item := default (list) .Values.mothership.server.extraEnv -}}
    {{- $name := index $item "name" -}}
    {{- if has $name $sharedBoundaryKeys -}}
      {{- fail (printf "mothership.server.extraEnv[%s] is a shared boundary secret; keep it in app.env.%s" $name $name) -}}
    {{- end -}}
  {{- end -}}
  {{- range $key := list "ENCRYPTION_KEY" "API_ENCRYPTION_KEY" -}}
    {{- $value := index $appEnv $key -}}
    {{- if and $value (ne (toString $value) "") (ne (toString $value) "<nil>") (not (regexMatch "^[0-9a-fA-F]{64}$" (toString $value))) -}}
      {{- fail (printf "app.env.%s must be a 64-character hex string when mothership.enabled=true. Generate with: openssl rand -hex 32" $key) -}}
    {{- end -}}
  {{- end -}}
  {{- if .Values.externalSecrets.enabled -}}
    {{- range $key := list "SIM_TO_MOTHERSHIP_API_KEY" "MOTHERSHIP_TO_SIM_CALLBACK_KEY" "MOTHERSHIP_ADMIN_API_KEY" "ENCRYPTION_KEY" "API_ENCRYPTION_KEY" -}}
      {{- $inEnv := index $appEnv $key -}}
      {{- $mapped := index $appRemoteRefs $key -}}
      {{- if and (or (not $inEnv) (eq (toString $inEnv) "") (eq (toString $inEnv) "<nil>")) (not $mapped) -}}
        {{- fail (printf "Required key '%s' is missing for mothership.enabled=true: set app.env.%s or map externalSecrets.remoteRefs.app.%s" $key $key $key) -}}
      {{- end -}}
    {{- end -}}
  {{- else if not $useExistingAppSecret -}}
    {{- range $key := list "SIM_TO_MOTHERSHIP_API_KEY" "MOTHERSHIP_TO_SIM_CALLBACK_KEY" "MOTHERSHIP_ADMIN_API_KEY" "ENCRYPTION_KEY" "API_ENCRYPTION_KEY" -}}
      {{- $value := index $appEnv $key -}}
      {{- if or (not $value) (eq (toString $value) "") (eq (toString $value) "<nil>") -}}
        {{- fail (printf "app.env.%s is required when mothership.enabled=true" $key) -}}
      {{- end -}}
    {{- end -}}
  {{- end -}}
  {{- if and (not .Values.mothership.server.secret.create) (or (not .Values.mothership.server.secret.name) (eq .Values.mothership.server.secret.name "")) -}}
    {{- fail "mothership.server.secret.name must be provided when mothership.server.secret.create=false" -}}
  {{- end -}}
  {{- if .Values.externalSecrets.enabled -}}
    {{- if not (index $mothershipRemoteRefs "SIM_BASE_URL") -}}
      {{- fail "externalSecrets.remoteRefs.mothership.SIM_BASE_URL is required when mothership.enabled=true and externalSecrets.enabled=true" -}}
    {{- end -}}
  {{- else if .Values.mothership.server.secret.create -}}
    {{- if not (and $mothershipEnv (index $mothershipEnv "SIM_BASE_URL") (ne (index $mothershipEnv "SIM_BASE_URL") "")) -}}
      {{- fail "mothership.server.env.SIM_BASE_URL is required when mothership.enabled=true" -}}
    {{- end -}}
  {{- end -}}
{{- end -}}
{{- end }}

{{/*
Copilot environment secret name
*/}}
{{- define "sim.copilot.envSecretName" -}}
{{- if and .Values.copilot.server.secret.name (ne .Values.copilot.server.secret.name "") -}}
{{- .Values.copilot.server.secret.name -}}
{{- else -}}
{{- printf "%s-copilot-env" (include "sim.fullname" .) -}}
{{- end -}}
{{- end }}

{{/*
Copilot database secret name
*/}}
{{- define "sim.copilot.databaseSecretName" -}}
{{- if .Values.copilot.postgresql.enabled -}}
{{- printf "%s-copilot-postgresql-secret" (include "sim.fullname" .) -}}
{{- else if and .Values.copilot.database.existingSecretName (ne .Values.copilot.database.existingSecretName "") -}}
{{- .Values.copilot.database.existingSecretName -}}
{{- else -}}
{{- printf "%s-copilot-database-secret" (include "sim.fullname" .) -}}
{{- end -}}
{{- end }}

{{/*
Copilot database secret key
*/}}
{{- define "sim.copilot.databaseSecretKey" -}}
{{- default "DATABASE_URL" .Values.copilot.database.secretKey -}}
{{- end }}

{{/*
Validate Copilot configuration
*/}}
{{- define "sim.copilot.validate" -}}
{{- if .Values.copilot.enabled -}}
  {{- if and (not .Values.copilot.server.secret.create) (or (not .Values.copilot.server.secret.name) (eq .Values.copilot.server.secret.name "")) -}}
    {{- fail "copilot.server.secret.name must be provided when copilot.server.secret.create=false" -}}
  {{- end -}}
  {{- if .Values.copilot.server.secret.create -}}
    {{- $env := .Values.copilot.server.env -}}
    {{- $required := list "AGENT_API_DB_ENCRYPTION_KEY" "INTERNAL_API_SECRET" "LICENSE_KEY" "SIM_BASE_URL" "SIM_AGENT_API_KEY" "REDIS_URL" -}}
    {{- range $key := $required -}}
      {{- if not (and $env (index $env $key) (ne (index $env $key) "")) -}}
        {{- fail (printf "copilot.server.env.%s is required when copilot is enabled" $key) -}}
      {{- end -}}
    {{- end -}}
    {{- $hasOpenAI := and $env (ne (default "" (index $env "OPENAI_API_KEY_1")) "") -}}
    {{- $hasAnthropic := and $env (ne (default "" (index $env "ANTHROPIC_API_KEY_1")) "") -}}
    {{- if not (or $hasOpenAI $hasAnthropic) -}}
      {{- fail "Set at least one of copilot.server.env.OPENAI_API_KEY_1 or copilot.server.env.ANTHROPIC_API_KEY_1" -}}
    {{- end -}}
  {{- end -}}
  {{- if .Values.copilot.postgresql.enabled -}}
    {{- if or (not .Values.copilot.postgresql.auth.password) (eq .Values.copilot.postgresql.auth.password "") -}}
      {{- fail "copilot.postgresql.auth.password is required when copilot.postgresql.enabled=true" -}}
    {{- end -}}
  {{- else -}}
    {{- if and (or (not .Values.copilot.database.existingSecretName) (eq .Values.copilot.database.existingSecretName "")) (or (not .Values.copilot.database.url) (eq .Values.copilot.database.url "")) -}}
      {{- fail "Provide copilot.database.existingSecretName or copilot.database.url when copilot.postgresql.enabled=false" -}}
    {{- end -}}
  {{- end -}}
{{- end -}}
{{- end }}
