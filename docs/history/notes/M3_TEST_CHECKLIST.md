# M3 test checklist

## Automated core checks

- `npm run typecheck`
- `npm run build`
- compiled Node test suite remains green
- `dist/product.d.ts` exists
- browser-safe product entry does not export parser internals

## Frontend install/build (run on a machine with npm registry access)

```bash
cd frontend
npm install
npm run build
npm run dev
```

## Browser persistence test

1. Open the Vite URL.
2. Click `+ Тестовий` twice.
3. Verify two independently stored rows appear in the left library.
4. Open each row and verify the center changes.
5. Reload the browser with F5.
6. Verify both rows survive and remain openable.
7. Delete one row.
8. Reload again.
9. Verify the deleted row does not return.

## Layout check

- Left: compact library.
- Center: rendered product statblock.
- Right: encounter placeholder.
- Parser diagnostic harness remains separate and unchanged.
