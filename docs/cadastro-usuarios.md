# Cadastro de usuários por administradores

Em Gestão de Acessos, use **Novo usuário**, informe nome, e-mail, nível e escopo e clique em **Criar e enviar acesso**. A conta aparece na lista e recebe login, senha aleatória e link do portal por e-mail. A pessoa pode alterar a senha no perfil.

O servidor valida a sessão e exige `profiles.role = 'admin'`; administradores de projeto não podem usar esta operação. A senha não é retornada ao navegador nem gravada em `profiles`.

## Configuração no ambiente de execução

- `SUPABASE_SERVICE_ROLE_KEY`: chave administrativa do mesmo projeto Supabase. Configure somente no servidor, sem prefixo `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_SUPABASE_URL`: endereço do projeto.
- `ZOHO_EMAIL` e `ZOHO_PASSWORD`: remetente e senha de aplicativo do Zoho SMTP.
- `NEXT_PUBLIC_SITE_URL`: endereço público do portal, usado no link de login.

O banco deve conter as colunas `profiles.email` e `profiles.escopo`, usadas pelo restante do sistema. Reinicie o servidor após configurar as variáveis.

Se a configuração SMTP falhar na verificação inicial, nenhuma conta é criada. Se o envio falhar após a criação, a tela informa que a conta existe e orienta recuperar a senha na página de login. Não repita o cadastro nesse caso. Aceitação pelo SMTP não garante entrega na caixa de entrada.

Verificação automatizada: `node --test tests/acessos-route.test.cjs`. Os testes simulam Supabase e SMTP, sem criar contas ou enviar e-mails reais.
