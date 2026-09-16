# Kikiu Gastro Bar — site

O site do Kikiu Gastro Bar, em **https://kikiu.com.br**.

Repositorio proprio, projeto proprio na Vercel, dominio proprio. Nao divide
nada com as outras casas do grupo nem com a FJN — cada uma tem o seu.

## O que tem aqui

| | |
|---|---|
| `index.html` | a home
| `bebidas.html` | o cardapio que o QR code da mesa abre
| `opiniao.html` | a pagina de "como foi?" do QR da mesa (gerada por `scripts/build-opiniao.mjs`) |
| `assets/` | imagens, CSS e JS **so desta casa** |
| `casa.json` | o dominio, os alternativos e o numero de mesas — **fonte unica** |
| `vercel.json` | gerado por `scripts/aplicar-dominios.mjs`. **Nao editar a mao** |
| `cardapios/` | producao grafica do impresso (nao sobe para producao) |

## Publicar

Automatico: **push na `main` → a Vercel publica**. Ninguem publica na mao.

## Mudou o dominio, o numero de mesas ou o ID do Analytics

1. edite `casa.json`
2. **no seu PC (PowerShell):**

   ```
   node scripts/aplicar-dominios.mjs
   ```

3. commit + push

Isso reescreve canonical, Open Graph, JSON-LD, `sitemap.xml`, `robots.txt` e
o `vercel.json` inteiro. Editar o `vercel.json` a mao e perder a edicao na
proxima vez que alguem rodar o script.

## QR codes das mesas

**no seu PC (PowerShell):**

```
python3 scripts/gerar-qrcode.py
```

Sai `cardapios/qrcode-mesa.html`, com dois QR por mesa (cardapio e opiniao).
