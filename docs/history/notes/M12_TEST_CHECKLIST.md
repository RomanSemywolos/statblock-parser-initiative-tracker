# M12 manual test checklist

1. Start backend on port 3030 and frontend normally.
2. Open **Налаштування**.
3. Confirm Backend URL points to the current frontend hostname on port 3030.
4. Click **Перевірити з’єднання**.
5. Confirm the status reports the configured model and the model profile appears.
6. Click **Зберегти**, reload the page, and confirm Backend URL/profile persist.
7. Change Backend URL to an unused port and confirm connection check reports an error without breaking the library/encounter.
8. Restore the correct URL.
9. From another device in the LAN, open the frontend and use the PC LAN address for Backend URL; connection check should succeed when firewall/network allows it.
10. Run root typecheck/tests and frontend build.
