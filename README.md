# Performance Tracker

// ===============================================

// 1. PARÂMETROS DE DIAS

// ===============================================

DU Totais = MAX(dParametros[Dias_Uteis_Totais])

DU Decorridos = MAX(dParametros[Dias_Uteis_Decorridos])

// ===============================================

// 2. SERVIÇOS

// ===============================================

Realizado Servicos = SUM(fVendas[Serviços])

Meta Servicos = SUM(dMetas[Meta_Servicos])

Media Diaria Servicos = DIVIDE([Realizado Servicos], [DU Decorridos], 0)

Projecao Servicos = [Media Diaria Servicos] * [DU Totais]

Performance Servicos % = DIVIDE([Realizado Servicos], [Meta Servicos], 0)

Projecao Servicos % = DIVIDE([Projecao Servicos], [Meta Servicos], 0)

// ===============================================

// 3. PEÇAS

// ===============================================

Realizado Pecas = SUM(fVendas[Peças])

Meta Pecas = SUM(dMetas[Meta_Pecas])

Media Diaria Pecas = DIVIDE([Realizado Pecas], [DU Decorridos], 0)

Projecao Pecas = [Media Diaria Pecas] * [DU Totais]

Performance Pecas % = DIVIDE([Realizado Pecas], [Meta Pecas], 0)

Projecao Pecas % = DIVIDE([Projecao Pecas], [Meta Pecas], 0)

// ===============================================

// 4. TOTAL CONSOLIDADO

// ===============================================

Realizado Total = [Realizado Servicos] + [Realizado Pecas]

Meta Total = [Meta Servicos] + [Meta Pecas]

Media Diaria Total = DIVIDE([Realizado Total], [DU Decorridos], 0)

Projecao Total = [Projecao Servicos] + [Projecao Pecas]

Performance Total % = DIVIDE([Realizado Total], [Meta Total], 0)

Projecao Total % = DIVIDE([Projecao Total], [Meta Total], 0)

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://biz-perf-buddy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b71e9ece-a825-54cf-a85b-9fe52a9ef6d0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
