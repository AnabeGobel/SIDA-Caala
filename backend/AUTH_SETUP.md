# Configuração de autenticação e RBAC

## 1. Preparar o Supabase

1. No SQL Editor do projeto Supabase, executar, por ordem, `migrations/001_auth_profiles.sql`, `migrations/002_detection_analyses.sql` e `migrations/003_profile_phone.sql`. As migrações criam os perfis, a tabela de análises e o bucket privado `analysis-images`, e adicionam o telefone de contacto ao perfil.
2. Em Authentication, desativar inscrições públicas. As contas passam a ser criadas pela API admin.
3. Configurar SMTP e, em Authentication → URL Configuration, permitir `http://localhost:8080/redefinir-senha` como Redirect URL local. Em produção, adicionar o endereço HTTPS real do frontend.
4. Guardar a URL do projeto e a service-role key apenas no ambiente do backend. Nunca usar a service-role key em variáveis `VITE_*`.

## 2. Configurar os ambientes

No `backend/.env`, definir:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
MODEL_PATH=models/best.pt
SECONDARY_MODEL_PATH=models/best2.pt
FRONTEND_URL=https://<dominio-do-frontend>
CORS_ORIGINS=http://localhost:5173,http://localhost:8080,https://<dominio-do-frontend>
```

Em desenvolvimento local, `FRONTEND_URL` pode ser `http://localhost:8080`.
Convites e pedidos administrativos de redefinição usam a origem do pedido
quando ela corresponde a uma origem autorizada em `CORS_ORIGINS`; sem uma
origem válida, usam `FRONTEND_URL`. Por isso, mantenha localhost e o domínio
publicado na lista `CORS_ORIGINS` quando ambos precisarem funcionar. No
Supabase, adicione também ambos os endereços de `/redefinir-senha` à lista de
Redirect URLs autorizados.

O serviço guarda automaticamente cada análise e a imagem original no bucket
privado. O histórico é consultado por endpoints autenticados: operadores veem
os próprios registos e administradores/investigadores podem consultar todos.
O serviço de deteção usa ambos os checkpoints: `best2.pt` para alicate e chave
de fendas, `best.pt` para chaves inglesas, e confirmação por concordância para
as classes partilhadas. Ambos os ficheiros precisam estar disponíveis nos
caminhos configurados.

No `FrontEnd/.env`, definir:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
VITE_API_URL=http://localhost:8001
```

## 3. Criar o primeiro administrador

No PowerShell, a partir da pasta `backend`:

```powershell
python -m pip install -r requirements.txt
python create_admin.py --email admin@instituicao.ao --name "Administrador inicial"
```

O comando solicita a palavra-passe sem a mostrar e recusa criar outro administrador se já existir um. Depois do primeiro login, a gestão de novas contas é feita em `/utilizadores`: o Supabase envia o convite ao e-mail indicado e a pessoa abre a ligação para definir a própria palavra-passe em `/redefinir-senha`. O SMTP e a Redirect URL precisam estar configurados para a entrega funcionar.

## 4. Fronteira de autorização

O frontend filtra navegação e páginas para cada função. O FastAPI valida o access token com Supabase e consulta `profiles` em cada pedido protegido; a autorização não depende do papel enviado pelo browser. A API usa a service-role key apenas no servidor, pelo que esta chave deve permanecer secreta.

Papéis aceites: `operador`, `admin` e `investigador`. A rota de inferência aceita os três. As rotas `/api/admin/*` aceitam apenas `admin`. Contas com `ativo = false` deixam de passar a dependência de autenticação da API.

Cada utilizador autenticado pode atualizar o próprio nome, e-mail, telefone de contacto e palavra-passe em Configurações. A alteração da palavra-passe requer confirmação. A gestão de contas permite ao administrador desativar/revogar o acesso ou eliminar utilizadores, sem permitir eliminar ou desativar o último administrador ativo.

As páginas Monitorização e Sistema consultam o endpoint administrativo
`/api/admin/operations`. A monitorização verifica a ligação à tabela de análises
e ao bucket privado, recolhe recursos do processo anfitrião e mostra os pedidos
observados desde o arranque do backend. As contagens e tempos de inferência são
lidos do Supabase; os indicadores de tráfego são em memória e reiniciam quando
o backend reinicia. O endpoint requer a função de administrador.

## Limitações atuais

Os indicadores de confiança, volume de análises e tempo de inferência são
calculados a partir dos registos reais. Precision, recall, F1 e mAP exigem
rótulos de referência revisados e não devem ser inferidos apenas da confiança
do modelo. Datasets, treino e versionamento/ativação de modelos continuam fora
deste fluxo.