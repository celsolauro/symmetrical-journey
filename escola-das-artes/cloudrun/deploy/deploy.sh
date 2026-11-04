#!/usr/bin/env bash
# Publicação do Painel Escola das Artes no Cloud Run protegido por IAP.
# Usa somente o Google Cloud CLI oficial (gcloud) e o login da própria conta.
# Não grava nem imprime tokens, chaves ou senhas.
#
# Uso (a partir da pasta escola-das-artes/cloudrun, de preferência no Cloud Shell):
#   ./deploy/deploy.sh verificar            # somente leitura: conta, projeto, faturamento, organização
#   ./deploy/deploy.sh preparar             # ativa APIs e cria a conta de serviço sem papéis
#   ./deploy/deploy.sh publicar SHEET_ID    # implanta com --no-allow-unauthenticated e --iap
#   ./deploy/deploy.sh testar SHEET_ID      # testa bloqueio anônimo e privacidade da planilha
#   ./deploy/deploy.sh bloquear             # emergência: corta todo acesso externo ao serviço
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-surrebiflu-1}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-escola-das-artes}"
SA_NAME="${SA_NAME:-escola-artes-leitor}"
ALLOWED_EMAIL="${ALLOWED_EMAIL:-celsolauro@gmail.com}"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
DEMO_SHEET_ID="1hO9u9bfNCcl4ukPH5GVXWQvwn2a0tZVxpEf2GR9ag6g"
APIS=(run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iap.googleapis.com sheets.googleapis.com)

cd "$(dirname "$0")/.."
G=(gcloud --project="$PROJECT_ID" --quiet)
say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
die() { printf '\n\033[31mPARADO: %s\033[0m\n' "$*" >&2; exit 1; }
confirm() { read -r -p "$1 [digite SIM para continuar] " ans; [[ "$ans" == "SIM" ]] || die "cancelado pelo usuário"; }
project_number() { gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)'; }
valid_sheet_id() {
  [[ "${1:-}" =~ ^[A-Za-z0-9_-]{20,100}$ ]] || die "informe o ID da planilha PRIVADA (o trecho entre /d/ e /edit da URL)"
  [[ "$1" != "$DEMO_SHEET_ID" ]] || die "esse é o ID da planilha de DEMONSTRAÇÃO, que é pública por link. Use a cópia privada."
}

verificar() {
  say "Conta autenticada"
  gcloud auth list --format='table(account,status)'
  local active; active="$(gcloud auth list --filter=status:ACTIVE --format='value(account)')"
  [[ "$active" == "$ALLOWED_EMAIL" ]] || die "conta ativa é '$active'; faça 'gcloud auth login' com $ALLOWED_EMAIL"
  say "Projeto"
  echo "config: $(gcloud config get-value project 2>/dev/null)"
  gcloud projects describe "$PROJECT_ID" --format='table(projectId,projectNumber,lifecycleState)' \
    || die "sem acesso ao projeto $PROJECT_ID"
  say "Faturamento (Cloud Run exige conta de faturamento vinculada)"
  gcloud billing projects describe "$PROJECT_ID" --format='value(billingEnabled)' 2>/dev/null \
    || echo "não foi possível ler (requer permissão de faturamento); confira no Console > Faturamento"
  say "Organização"
  gcloud projects get-ancestors "$PROJECT_ID" --format='table(id,type)' || true
  if gcloud projects get-ancestors "$PROJECT_ID" --format='value(type)' 2>/dev/null | grep -q organization; then
    echo "O projeto está em uma organização. Conferindo restrição de domínio para contas @gmail.com:"
    gcloud resource-manager org-policies describe iam.allowedPolicyMemberDomains --project="$PROJECT_ID" --effective 2>/dev/null \
      || echo "sem permissão para ler a política (ok se não houver restrição)"
    echo "ATENÇÃO: com organização, o cliente OAuth gerenciado pelo Google pode aceitar só usuários da organização."
    echo "Se o login com $ALLOWED_EMAIL for recusado, siga 'Cliente OAuth personalizado' no LEIA-ME."
  fi
  say "Seus papéis no projeto"
  gcloud projects get-iam-policy "$PROJECT_ID" --flatten='bindings[].members' \
    --filter="bindings.members:user:$ALLOWED_EMAIL" --format='value(bindings.role)' 2>/dev/null \
    || echo "não foi possível ler a política IAM do projeto"
  say "APIs necessárias"
  local enabled; enabled="$("${G[@]}" services list --enabled --format='value(config.name)' 2>/dev/null || true)"
  for api in "${APIS[@]}"; do grep -qx "$api" <<<"$enabled" && echo "ativa:     $api" || echo "inativa:   $api"; done
  say "Verificação concluída (nada foi alterado)"
}

preparar() {
  verificar
  say "Vai ativar APIs (${APIS[*]}) e criar a conta de serviço $SA_EMAIL SEM nenhum papel no projeto."
  confirm "Prosseguir?"
  "${G[@]}" services enable "${APIS[@]}"
  if ! "${G[@]}" iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1; then
    "${G[@]}" iam service-accounts create "$SA_NAME" \
      --display-name="Escola das Artes - leitura da planilha" \
      --description="Identidade do Cloud Run. Sem papéis no projeto; só tem Leitor na planilha privada via Drive."
  fi
  "${G[@]}" beta services identity create --service=iap.googleapis.com >/dev/null \
    || echo "aviso: não criei o agente de serviço do IAP agora; ele é criado ao ativar o IAP no deploy."
  say "Pronto. Próximo passo MANUAL no Google Drive:"
  echo "Compartilhe a planilha PRIVADA com: $SA_EMAIL  (permissão: Leitor; desmarque 'Notificar')."
}

publicar() {
  local sheet_id="${1:-}"; valid_sheet_id "$sheet_id"
  local num; num="$(project_number)"
  local aud="/projects/${num}/locations/${REGION}/services/${SERVICE}"
  "${G[@]}" iam service-accounts describe "$SA_EMAIL" >/dev/null || die "rode 'preparar' antes"
  say "Vai implantar '$SERVICE' em $REGION com: --no-allow-unauthenticated --iap, conta $SA_EMAIL, min 0 / máx 2 instâncias."
  confirm "Prosseguir com o deploy?"
  "${G[@]}" run deploy "$SERVICE" --source . --region="$REGION" \
    --service-account="$SA_EMAIL" \
    --no-allow-unauthenticated --iap --ingress=all \
    --min-instances=0 --max-instances=2 --cpu=1 --memory=256Mi --concurrency=40 --timeout=30 \
    --set-env-vars="SHEET_ID=${sheet_id},ALLOWED_EMAILS=${ALLOWED_EMAIL},IAP_AUDIENCE=${aud}"

  say "Permitindo que somente o agente do IAP invoque o serviço"
  "${G[@]}" run services add-iam-policy-binding "$SERVICE" --region="$REGION" \
    --member="serviceAccount:service-${num}@gcp-sa-iap.iam.gserviceaccount.com" --role=roles/run.invoker >/dev/null

  say "Liberando o IAP exclusivamente para $ALLOWED_EMAIL"
  "${G[@]}" iap web add-iam-policy-binding --resource-type=cloud-run --service="$SERVICE" --region="$REGION" \
    --member="user:${ALLOWED_EMAIL}" --role=roles/iap.httpsResourceAccessor >/dev/null

  auditar_iam
  testar "$sheet_id"
}

auditar_iam() {
  say "Auditoria das permissões do serviço"
  local run_policy iap_policy
  run_policy="$("${G[@]}" run services get-iam-policy "$SERVICE" --region="$REGION" --format=json)"
  iap_policy="$("${G[@]}" iap web get-iam-policy --resource-type=cloud-run --service="$SERVICE" --region="$REGION" --format=json)"
  echo "Cloud Run (invocadores):"; grep -o '"[a-zA-Z]*:[^"]*"' <<<"$run_policy" | sort -u
  echo "IAP (acesso ao app):";     grep -o '"[a-zA-Z]*:[^"]*"' <<<"$iap_policy" | sort -u
  if grep -Eq 'allUsers|allAuthenticatedUsers' <<<"$run_policy$iap_policy"; then bloquear; die "acesso público encontrado; serviço bloqueado"; fi
  local others; others="$(grep -o '"user:[^"]*"\|"group:[^"]*"\|"domain:[^"]*"' <<<"$iap_policy" | grep -v "user:${ALLOWED_EMAIL}" || true)"
  [[ -z "$others" ]] || { bloquear; die "IAP tem outros membros além de $ALLOWED_EMAIL: $others"; }
  echo "OK: nenhum acesso público; IAP restrito a $ALLOWED_EMAIL."
}

testar() {
  local sheet_id="${1:-}"; valid_sheet_id "$sheet_id"
  local url; url="$("${G[@]}" run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')"
  [[ -n "$url" ]] || die "serviço não encontrado"
  say "Teste 1: acesso anônimo deve ser bloqueado ($url)"
  local failed=0
  for p in / /api/professores /app.js; do
    local out code; out="$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 20 "$url$p")"; code="${out%% *}"
    echo "  $p -> $out"
    if [[ "$code" == 2* ]]; then failed=1; fi
  done
  if (( failed )); then bloquear; die "uma rota respondeu sem login; o serviço foi bloqueado (ingress internal)"; fi
  echo "OK: sem login, nenhuma rota responde com conteúdo."

  say "Teste 2: a planilha de produção não pode ser lida sem login"
  local sc; sc="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://docs.google.com/spreadsheets/d/${sheet_id}/gviz/tq?tqx=out:csv")"
  echo "  leitura anônima da planilha -> HTTP $sc"
  [[ "$sc" != 200 ]] || die "a planilha está PÚBLICA. Em Compartilhar, mude 'Acesso geral' para 'Restrito' antes de usar."
  echo "OK: planilha privada."

  say "Teste 3 (manual): abra $url numa janela anônima"
  echo "  - entre com $ALLOWED_EMAIL: o painel deve carregar e o status dizer 'Fonte: Google Sheets · atualizado às ...'"
  echo "  - depois rode: ./deploy/deploy.sh logs   (confirma o 200 em /api/professores e o e-mail no IAP)"
  echo
  echo "URL do painel: $url"
}

logs() {
  say "Últimas requisições ao serviço (Cloud Logging)"
  "${G[@]}" logging read \
    "resource.type=cloud_run_revision AND resource.labels.service_name=${SERVICE} AND (httpRequest.requestUrl:\"/api/professores\" OR severity>=ERROR)" \
    --freshness=1h --limit=20 --format='table(timestamp,httpRequest.status,httpRequest.requestUrl,textPayload,jsonPayload.message,jsonPayload.error)'
}

bloquear() {
  say "BLOQUEIO: restringindo o ingresso do serviço a tráfego interno"
  "${G[@]}" run services update "$SERVICE" --region="$REGION" --ingress=internal >/dev/null && echo "serviço inacessível pela internet."
}

case "${1:-}" in
  verificar) verificar ;;
  preparar) preparar ;;
  publicar) publicar "${2:-}" ;;
  testar) testar "${2:-}" ;;
  auditar) auditar_iam ;;
  logs) logs ;;
  bloquear) bloquear ;;
  *) sed -n '2,13p' "$0"; exit 1 ;;
esac
