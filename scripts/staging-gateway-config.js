// Temporary HTTPS staging gateway. Admission is separate from application JWTs.
function buildConfig(token) {
  if (!/^[a-f0-9]{64}$/.test(token || '')) throw new Error('A random 32-byte hexadecimal admission token is required');
  const proxy = `proxy_pass http://web:3000;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`;
  const health = ['', '/ready', '/build-info', '/staging-diagnostics'].map(suffix => `
    location = /api/v1/health${suffix} {
      ${proxy}
    }`).join('');
  return `events {}
http {
  server_tokens off;
  map_hash_bucket_size 128;
  map $cookie_homeland_staging_access $staging_admitted {
    default 0;
    "${token}" 1;
  }
  server {
    listen 8080;
    client_max_body_size 20m;
    location = /__staging/access {
      auth_basic "HomeLand isolated staging";
      auth_basic_user_file /etc/nginx/.htpasswd;
      proxy_pass http://web:3000/login;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header Authorization "";
      add_header Set-Cookie "homeland_staging_access=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=14400";
      add_header Cache-Control "no-store" always;
    }${health}
    location / {
      if ($staging_admitted = 0) { return 403; }
      ${proxy}
    }
  }
}
`;
}
module.exports = { buildConfig };
