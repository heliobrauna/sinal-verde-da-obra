<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep viability as a BDI 18%–0% area range; persist 18% only as the conservative legacy database value, because users no longer choose BDI.
- For sale simulations, derive the asking price as `(total costs + desired profit in BRL) / (1 - brokerage rate)`, because profit is a currency target and brokerage must be covered by the sale.
- Reserve desired profit/remuneration from buildable credit in both goals, but add it only once to the sale price; honoraria and administration flow through the expense breakdown so they are never added again to total costs.
- Use labor plus materials per m² as the real build cost for area and sale calculations; keep published CUB and CUB+10% as non-binding comparison only. Persist new simulation assumptions inside resultado JSON so legacy records remain readable without schema changes.
- Post-construction installments are cash outflows, not wholly interest expense; show estimated financing charges separately and label investor return assumptions instead of asserting bank-exact totals.
- Persist entry, FGTS intended for use, lot equity, annual compound-equivalent interest and PCI monthly releases in resultado JSON; keep the legacy monthly rate column monthly so old simulations can be edited without migration.
- Apply PCI releases only to financing remaining after lot payoff; preset 18 months over 320 m² and treat the table as editable planning assumptions rather than lender guarantees.
- Do not deduct a fixed contingency reserve: viable area uses all operational resources; old simulations may still carry `contingencia` inside resultado and are shown without it.
- Registry fees (compra e venda on lot value, alienação fiduciária on financed value) come from per-UF bracket tables in `src/lib/emolumentos.ts` (CE = TJCE 2026 Tabela VII); UFs without a table fall back to a labeled 0,5% estimate. The SFH first-home flag halves both (Art. 290, Lei 6.015/73) and is persisted in resultado as `primeiroImovelSfh`.
- The result page hides every zero-valued item and leads with area, total cost, sale/resources and profit/balance.
- Down payment is derived from the contract, not typed: inputs mirror the Caixa simulator in BRL (valor do imóvel, valor do financiamento; valor de entrada = imóvel - financiamento, read-only), no percentages, filled first by lot equity (ágio), then FGTS, then cash ("dinheiro necessário"). Equity and FGTS never become extra construction money; the construction budget is operation value - lot value, and releases for the build are capped by it. Legacy `entradaDinheiro` is ignored; legacy records without `valorOperacao` default to financed / 80%. The entry is proof of funds, not a payment to the bank; its cash part is applied to the build.
- Construction money pays construction, extras and "Durante a obra" expenses only. Pre-contract and signing expenses, cash entry and monthly construction interest are the client's own outlay (`desembolso*`), shown separately; FGTS never pays fees or interest. Investor (the borrower who lends their credit) capital is a dated cash-flow list: own-lot equity, FGTS and cash in the entry, pre-build expenses, 10% start working capital (net of entry cash/FGTS, returned at the end of the build), monthly construction interest and installments until the sale.
- For sale, the lot value is part of the cost base: sale price = (costs + lot + profit) / (1 - brokerage), and scenario results subtract the lot too.
- Building permit estimate: R$ 2,00 per m² + R$ 52,00; permit and INSS estimates follow the planned area (viable area until it is set).
- Lot origin: investidor (own lot; equity counts in the entry and as investor capital; no ITBI/purchase registry when paid off), construtor or compra (lot bought in the operation: no equity, ITBI and registry due, full price paid to the seller at signing; the builder receives it).
- Sale split is a cascade: return investor capital, then a preferred return at net Selic (regressive IR by term) + premium, then split the surplus by the investor share. Investor return is an annualized IRR compared with net Selic; Selic comes from the BCB SGS series 432 (editable).
