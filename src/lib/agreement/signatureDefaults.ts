/**
 * Default HTML for a "signatures" section — two-party execution block.
 * Styled via `.signatures-sec` in `renderHtml.ts` (inner markup is sanitized; no inline classes required).
 */
export const DEFAULT_SIGNATURE_SECTION_HTML = `<p><em>IN WITNESS WHEREOF</em>, the parties have executed this agreement as of the date last written below.</p>
<table><tbody><tr>
<td>
<p>________________________________________</p>
<p><strong>Artist / Performer</strong></p>
<p>{{artist_name}}</p>
<p>Date: _________________________________________</p>
</td>
<td>
<p>________________________________________</p>
<p><strong>Venue / Authorized representative</strong></p>
<p>{{venue_name}}</p>
<p>By: _________________________________________</p>
<p>Title: _______________________________________</p>
<p>Date: _________________________________________</p>
</td>
</tr></tbody></table>`
