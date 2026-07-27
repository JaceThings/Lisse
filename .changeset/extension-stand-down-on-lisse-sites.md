---
"@lisse/extension": patch
---

Stand down entirely on pages that already ship Lisse. The extension now looks for the `[data-slot="smooth-corners"]` marker that every framework binding stamps on the elements it manages; finding it, it undoes everything it has applied, disconnects its observers and stops. Previously both the page's own Lisse and the extension clipped the same elements, so corners on sites built with Lisse were smoothed twice and rendered chopped.
