; Uninstall asks before deleting history, and never deletes it by default.
;
; The prompt's No button is the default (MB_DEFBUTTON2), so pressing Enter keeps
; the data. Silent uninstall always keeps it unless NIYAM_UNINSTALL_DELETE_DATA=1
; is set, which exists so the destructive branch can be exercised without a human
; clicking a dialog.

!macro customUnInstall
  ; The app registers itself to start with Windows; removing it must not leave a
  ; login item pointing at an executable that no longer exists.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Niyam"

  ReadEnvStr $0 "NIYAM_UNINSTALL_DELETE_DATA"
  IfSilent niyam_uninstall_silent

  MessageBox MB_YESNO|MB_DEFBUTTON2 "Delete your Niyam history too?$\r$\n$\r$\nYour days, tasks and settings live in $APPDATA\Niyam. Choose No to keep them for a later install." IDNO niyam_uninstall_done
  RMDir /r "$APPDATA\Niyam"
  Goto niyam_uninstall_done

  niyam_uninstall_silent:
  StrCmp $0 "1" 0 niyam_uninstall_done
  RMDir /r "$APPDATA\Niyam"

  niyam_uninstall_done:
!macroend
