# Publicação em subdiretório com Nginx

A aplicação utiliza uma única variável de ambiente para definir onde será publicada:

```env
# Raiz do domínio
BASE_PATH=

# Subdiretório
BASE_PATH=/medicina

# Subdiretório com mais de um nível
BASE_PATH=/sistemas/medicina
```

Não é necessário recompilar nem alterar o código. Reinicie o contêiner depois de mudar a variável.

## Exemplo para `/medicina/`

No `.env` da aplicação:

```env
BASE_PATH=/medicina
```

No Nginx:

```nginx
location = /medicina {
    return 308 /medicina/;
}

location /medicina/ {
    proxy_pass http://medicina-ocupacional:3737;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
}
```

O `proxy_pass` não deve ter `/` depois da porta nesse modelo. Assim, o Nginx preserva
`/medicina` ao encaminhar a requisição, e o Node reconhece o mesmo `BASE_PATH`.

## Exemplo para a raiz

No `.env`:

```env
BASE_PATH=
```

No Nginx:

```nginx
location / {
    proxy_pass http://medicina-ocupacional:3737;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Endereços resultantes

Com `BASE_PATH=/medicina`:

```text
/medicina/                         Interface
/medicina/api/dashboard/stats     API
/medicina/public/images/...       Recursos estáticos
```

As portas do Node e do MySQL devem permanecer restritas à rede Docker. Somente o
Nginx deve publicar a aplicação para a rede externa.
