import { useEffect, useState } from 'react';
import { api } from '../api/endpoints.js';
import { hasClassPrices } from '../lib/pricing.js';

// Whether the API bills classes yet (CHANGELOG Part B, B53), for pages that show no class themselves (help, terms,
// packages). Asked once per page load from the public class list; undefined while unknown, false if it can't tell.
let known;
let asking;

export function useClassPricing() {
  const [billed, setBilled] = useState(known);
  useEffect(() => {
    if (known !== undefined) return undefined;
    let live = true;
    asking ??= api.classes.list().then(
      (rows) => (known = hasClassPrices(rows)),
      () => {
        asking = undefined; // ask again on the next page
        return false;
      },
    );
    asking.then((value) => live && setBilled(value));
    return () => {
      live = false;
    };
  }, []);
  return billed;
}
