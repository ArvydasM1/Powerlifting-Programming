#!/usr/bin/env sh
# Installs the pre-commit secret scan required by SPEC.md §16.3.
set -e
HOOK=.git/hooks/pre-commit
if ! command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks is not on PATH. Install it (https://github.com/gitleaks/gitleaks) and re-run." >&2
  exit 1
fi
cat > "$HOOK" <<'EOF'
#!/usr/bin/env sh
# SPEC.md §16.3: block commits that contain secrets. Do not bypass with --no-verify for a finding you have not read.
gitleaks protect --staged --redact
EOF
chmod +x "$HOOK"
echo "pre-commit hook installed at $HOOK"
