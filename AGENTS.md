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
