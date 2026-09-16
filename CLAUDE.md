# Kikiu Gastro Bar — contexto para Claude Code

## O que e este repositorio

O site do **Kikiu Gastro Bar**, servido em **https://kikiu.com.br**.

Uma casa, um repositorio, um projeto na Vercel, um dominio. Ate 16/09/2026 as
tres casas do grupo (Saikō, Kikiu, Forneatto) viviam num repositorio so e num
projeto so da Vercel, com rewrite por host. Foi separado porque projeto
compartilhado mistura o que e de cada um: uma casa nao pode publicar e
derrubar a outra, e o dia em que uma sair leva a pasta dela inteira.

## ⚠️ Nao misturar nunca

- dominio de outra casa neste projeto da Vercel;
- codigo de outra casa neste repositorio;
- nada da FJN visivel no site do cliente.

Na duvida entre reaproveitar este projeto e criar um novo: **cria um novo.**

## ⚠️ Convencao de comandos — sempre dizer ONDE roda

O Fundador trabalha no **Windows, PowerShell**. Todo bloco de comando deve
dizer, antes dele, em qual maquina roda:

- **no seu PC (PowerShell)** — build local, geradores, CLI
- **no GitHub / na tela do painel** — o que e clique, nao comando

Na duvida entre mandar um comando e apontar uma tela, aponte a tela.

### PowerShell nao e bash

| Nao funciona | Use |
|---|---|
| `cd <raiz do repo>` | caminho real; `<` e redirecionamento e da `ParserError` |
| `cmd1 && cmd2` | uma linha por comando, ou `;` |
| `export VAR=1` | `$env:VAR = "1"` |
| `rm -rf pasta` | `Remove-Item pasta -Recurse -Force` |

## Deploy

**Push na `main` → a Vercel publica.** Ninguem publica na mao.

- `main` = producao — sempre trabalhar em branch + PR
- Nunca push direto na main com codigo nao testado

## A fonte unica dos dominios

`casa.json`. Depois de mexer nele, **no seu PC (PowerShell):**

```
node scripts/aplicar-dominios.mjs
```

Ele reescreve canonical, og:*, JSON-LD, `sitemap.xml`, `robots.txt` e o
`vercel.json` **inteiro** — inclusive os 301 dos dominios alternativos e o
proxy do sistema. **O `vercel.json` nao se edita a mao**: a edicao se perde
na proxima rodada. Ja aconteceu em 15/09.

## O sistema (reserva, agenda, opiniao)

As tres telas do site falam com o sistema por um **proxy no proprio dominio**:

| No site | Vai para |
|---|---|
| `/reservas-api/kikiu` | `/public/reservas/kikiu` |
| `/agenda-api/kikiu` | `/public/eventos/kikiu` |
| `/opiniao-api/kikiu` | `/public/opiniao/kikiu` |

O proxy roda no servidor da Vercel, entao **o navegador so ve
kikiu.com.br** — nunca o endereco de quem hospeda o sistema. E isso que
mantem o site limpo enquanto a instalacao propria do grupo nao existe
(plano em `SEPARACAO-DO-SISTEMA.md`, no repositorio do grupo).

## Foco

Este repositorio e **so o site do Kikiu Gastro Bar**. Nao tem painel, nao tem API,
nao tem as outras casas.
