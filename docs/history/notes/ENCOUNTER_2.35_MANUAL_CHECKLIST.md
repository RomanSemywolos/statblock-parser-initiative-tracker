# v2.35 manual regression checklist

1. Add the same library statblock twice.
2. Rename the two tracker copies to `Сильніший` and `Слабший`.
3. Reload; both names must survive.
4. Open `Сильніший`, click `Редагувати`, change AC or an action.
5. Confirm:
   - `Слабший` is unchanged;
   - the library statblock is unchanged.
6. Edit the library statblock.
7. Confirm both existing encounter copies stay unchanged.
8. Add a third copy.
9. Confirm the third copy contains the new library version.
10. Change card configuration in the library.
11. Confirm existing combatant mini-cards do not change.
12. Delete the source statblock from the library.
13. Confirm existing v3 encounter copies remain usable/editable.
14. Create `Додати учасника`.
15. Confirm it opens immediately in Edit mode and uses the same central width as a normal statblock.
16. Edit its name, HP, AC, initiative modifier and saves; reload and confirm persistence.
17. Rapidly type into an encounter statblock action and confirm no caret rollback from persistence.
