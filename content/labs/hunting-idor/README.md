# Northline Billing — local IDOR lab setup

On narrow screens, use **Menu** for Dashboard, Invoices and Lab Guide. Escape closes the expanded menu and returns focus to its button. Without JavaScript, navigation remains visible. The signed-in account stays outside the invoice document. Wide invoice tables keep readable columns: swipe or scroll inside the table, or focus the table region and use the arrow keys. Login errors are linked to the affected fields. The local server and authentication behavior are unchanged.

Northline Billing is a Client Billing Portal from the fictional Northline Demo Services. Training application by m1000z · Fictional data. Use Python 3.12 or newer with SQLite from the standard library. No pip packages or frontend build are needed.

Run the server on this computer only. It binds to 127.0.0.1. Never deploy or tunnel the vulnerable application. The portfolio serves a static ZIP; it does not run Python.

[Download the IDOR lab (.zip)](https://www.m1000z.com/assets/documents/hunting-idor-lab.zip). [Read the article](https://www.m1000z.com/posts/hunting-idor-web-applications/). Follow the Windows or Linux section below; their shell syntax is different. Copy commands without a shell prompt. Stop at an error and use the matching troubleshooting entry before continuing.

## Windows Step 1: Choose the installation route

**Already installed through WinGet? Start at Windows Step 2.** Successful installation does not prove that a launcher is on PATH. Do not reinstall repeatedly or request administrator access just because py is missing.

**Traditional installer:** use the [official Windows downloads](https://www.python.org/downloads/windows/) and select a full, supported Python runtime installer for your architecture. For the Python 3.13 installation in the failure case, follow the [3.13 full-installer instructions](https://docs.python.org/3.13/using/windows.html#the-full-installer). A per-user install is sufficient. Enable its PATH option; the legacy launcher is a separate optional component. If using WinGet instead, this is the traditional 3.13 runtime package, not the new Install Manager:

```powershell
winget install --id Python.Python.3.13 --exact --source winget --scope user
```

Do not run that installation command again if the runtime is already installed. Inspect it without installing:

```powershell
winget list --id Python.Python.3.13 --exact
```

**Legacy py launcher:** the optional traditional-launcher component locates existing runtimes. It is not the interpreter and does not support Install Manager installation subcommands. If it is installed, this lists registered executable paths:

```powershell
py -0p
```

**New Python Install Manager:** this is a different product, available through the official Python downloads/Store. Follow its [current installation instructions](https://docs.python.org/3/using/windows.html#python-install-manager). Only if you deliberately installed this product and pymanager resolves, use its management commands:

```powershell
Get-Command pymanager -All -ErrorAction SilentlyContinue
pymanager list
```

If its list has no suitable installed runtime, install one with the manager, then list again:

```powershell
pymanager install 3.13
pymanager list
```

Do not send these commands to the legacy launcher. Use the unambiguous pymanager name when both products coexist; a bare py may resolve to the older launcher. A manager alias may run through WindowsApps legitimately. A traditional 3.13 installation does not need the manager merely to run this lab.

## Windows Step 2: Restart the terminal, then diagnose

After installing Python or changing PATH/aliases, **completely close all PowerShell windows and the entire Windows Terminal application**, then start it again from Start. Opening another tab inside the old Terminal process can retain its old environment. Restart an IDE too if using its integrated terminal.

Check these separately. One failing does not establish that the other works:

```powershell
python --version
```

```powershell
py --version
```

Then inspect every matching command:

```powershell
Get-Command python, py -All -ErrorAction SilentlyContinue
```

**How to read the results:** a working entry prints an actual Python version. A command-not-found error means that name is unavailable. A WindowsApps path plus a Store-opening/“Python was not found” message identifies the placeholder in this failure case. The path alone is not proof: a real Store runtime or Install Manager also uses app aliases. Confirm by executing the version and SQLite checks, not by the filename alone. A PowerShell function or alias listed ahead of an Application can also shadow it.

The **-3 option belongs to the py launcher, not to the python interpreter**. When switching to an interpreter executable, remove the launcher selector entirely. Do not append it to python or to a full python.exe path. These commands do not require an execution-policy change.

## Windows Step 3: Recover the route you actually installed

### Traditional installer or the screenshot's WinGet 3.13 runtime

1. Open Start → Manage app execution aliases. If the failing entries belong to **App Installer** and point to the Store placeholder, turn off only its python.exe/python3.exe shortcuts. Do not disable all WindowsApps entries or a working Python Install Manager alias.
2. Open Installed apps → the Python runtime → Modify, or rerun its matching official installer. Enable **Add Python to environment variables/PATH** in the traditional installer's options. A missing legacy launcher can be added there if wanted, but it is not needed for a direct executable launch.
3. Alternatively, edit **User** environment variables → Path. Add the actual folder containing the verified python.exe, ahead of the Store-placeholder WindowsApps entry within User Path. Do not paste python.exe itself as a PATH directory, erase existing entries, or edit another application's/system Python. Scripts/ is unnecessary for this dependency-free lab.
4. Fully restart Terminal/PowerShell, repeat Windows Step 2, and compare sys.executable in Windows Step 4. If another earlier runtime still wins, keep using the exact verified executable instead of changing machine-wide settings.

### Python Install Manager route only

1. Check Installed apps for Python Install Manager. In Manage app execution aliases enable/refresh its **Python (default)** and **Python install manager** aliases. Do not apply the traditional-installer advice of disabling these working manager aliases.
2. Ensure User Path retains the actual WindowsApps folder, normally `$env:LOCALAPPDATA\Microsoft\WindowsApps`. Do not remove that folder globally. If a manager-generated runtime alias is missing, its documented refresh command is `pymanager install --refresh`; use this only with the manager.
3. Fully restart Terminal/PowerShell. Check pymanager resolution and list installed runtimes. If old py shadows the manager, use pymanager explicitly; no legacy-launcher uninstall is required for this lab. Confirm the desired runtime using Windows Step 4.

### Conditional direct executable — do not assume the folder exists

For the screenshot's traditional **per-user Python 3.13** installation, test the candidate:

```powershell
Test-Path "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe"
```

**Only if the result is True**, run:

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" --version
```

If it prints a supported version, select that same executable:

```powershell
$LabPython = "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe"
```

The valid PowerShell environment prefix here is `$env:LOCALAPPDATA`. The folder varies by version, architecture and per-user/all-users installation scope. If Test-Path returns False, **stop copying this path**. Use a working launcher's `py -0p`, the Install Manager's `pymanager list`, or the installed Python Start-menu shortcut's Open file location → Properties → Target to locate the actual interpreter, not IDLE/pythonw.exe. You can also inspect traditional runtime registrations read-only:

```powershell
Get-ChildItem 'HKCU:\Software\Python\PythonCore', 'HKLM:\Software\Python\PythonCore', 'HKLM:\Software\WOW6432Node\Python\PythonCore' -ErrorAction SilentlyContinue |
    ForEach-Object {
        $installKey = Get-Item -LiteralPath (Join-Path $_.PSPath 'InstallPath') -ErrorAction SilentlyContinue
        if ($installKey) {
            [PSCustomObject]@{
                Version = $_.PSChildName
                Executable = $installKey.GetValue('ExecutablePath')
                Folder = $installKey.GetValue('')
            }
        }
    }
```

Registrations may be absent for Store/manager/custom installs; no results do not establish a universal install location. After finding your executable, paste its real path at the prompt below, without surrounding quotes. Do not enter a made-up example path:

```powershell
$LabPython = Read-Host 'Full path to your actual python.exe, without surrounding quotes'
Test-Path -LiteralPath $LabPython -PathType Leaf
```

Continue only if that returns True. A quoted executable path is invoked with **&**, not by quoting it alone.

## Windows Step 4: Pin and verify one interpreter

**Choose one selection method, not all of them.** If the direct-path method above already set LabPython, skip these alternatives. Otherwise, if python --version succeeded with a supported runtime:

```powershell
$LabPython = (python -c "import sys; print(sys.executable)").Trim()
```

Or, only if py --version succeeded with the desired runtime:

```powershell
$LabPython = (py -c "import sys; print(sys.executable)").Trim()
```

For the **Install Manager route only**, after confirming 3.13 in its list, this selects its actual executable path without relying on which product owns py:

```powershell
$LabPython = (pymanager list --one --format=exe 3.13).Trim()
```

Run the following with the selected path. If any command fails, stop and resolve it before launching the lab:

```powershell
Test-Path -LiteralPath $LabPython -PathType Leaf
& $LabPython --version
& $LabPython -c "import sys, sqlite3; assert sys.version_info >= (3, 12), 'Python 3.12+ required'; c=sqlite3.connect(':memory:'); print('Python', sys.version.split()[0]); print('Executable:', sys.executable); print('SQLite', sqlite3.sqlite_version); print('SQLite query:', c.execute('SELECT 1').fetchone()[0]); c.close()"
```

**Expected result — not a command:** True; Python 3.12 or newer; the executable you selected; an SQLite version; and SQLite query: 1. Exact version numbers vary. Do not continue with a Store message, an older Python, or an import/DLL error.

LabPython is a variable in this PowerShell session only. Keep this window open and use **& $LabPython** for every remaining Windows command. In a new window, repeat interpreter selection/preflight and return to the extracted folder. Do not alternate among unverified command names.

## Windows Step 5: Extract into the correct folder

Download the actual ZIP. These defaults apply only if it is in your Downloads folder; change LabZip to the real file path if you saved it elsewhere. Choose a new destination, not an existing lab folder. Variables and LiteralPath preserve spaces in paths.

```powershell
$LabZip = Join-Path $env:USERPROFILE 'Downloads\hunting-idor-lab.zip'
$LabFolder = Join-Path $env:USERPROFILE 'Downloads\Northline Billing Lab'
if (-not (Test-Path -LiteralPath $LabZip -PathType Leaf)) { throw 'ZIP missing: correct LabZip before continuing.' }
if (Test-Path -LiteralPath $LabFolder) { throw 'Choose a new LabFolder; do not overwrite an existing lab.' }
Expand-Archive -LiteralPath $LabZip -DestinationPath $LabFolder
Set-Location -LiteralPath $LabFolder
Get-Location
Get-ChildItem
```

Verify the six required files. Every line must return True:

```powershell
Test-Path -LiteralPath '.\README.md' -PathType Leaf
Test-Path -LiteralPath '.\lab\app.py' -PathType Leaf
Test-Path -LiteralPath '.\lab\verify.py' -PathType Leaf
Test-Path -LiteralPath '.\lab\assets\app.css' -PathType Leaf
Test-Path -LiteralPath '.\lab\assets\app.js' -PathType Leaf
Test-Path -LiteralPath '.\lab\assets\northline-mark.svg' -PathType Leaf
```

**Folder structure — illustrative, not a command:**

```text
README.md
lab/
  app.py
  verify.py
  assets/
    app.css
    app.js
    northline-mark.svg
```

Do not work inside the ZIP viewer or inside lab/. If your extraction tool added a wrapper folder, enter the inner folder that directly contains README.md and lab/ and repeat all six checks.

## Windows Step 6: Start, stop, correct and verify

From that checked folder, with the interpreter verified in Windows Step 4, start **one** vulnerable server:

```powershell
& $LabPython .\lab\app.py --port 8000
```

For the screenshot's Python 3.13 installation, the equivalent direct-executable form below is an **alternative**, not a second server. Use it only if the earlier Test-Path was True and this exact executable passed version/SQLite checks:

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" .\lab\app.py --port 8000
```

**Expected startup output — not a command:** Northline Billing: http://127.0.0.1:8000 secure=False. Open that HTTP address on this computer. The server terminal stays running; no returned PowerShell prompt is normal.

Press **Ctrl+C** in the server terminal and wait for the prompt to return. Stop the vulnerable server before reusing the same port. Start corrected mode with the **same** interpreter:

```powershell
& $LabPython .\lab\app.py --secure --port 8000
```

**Expected startup output — not a command:** the same address with secure=True. Restarting resets the in-memory data and sessions. Sign in again and confirm the Training · Corrected badge. Your own invoice still works; the other customer's invoice is denied on both detail routes.

Stop again with Ctrl+C, then verify from the same folder and PowerShell session:

```powershell
& $LabPython .\lab\verify.py
```

**Expected result — not a command:** PASS, with assertions for authentication, session handling, owner-scoped data, detail access and local assets. The verifier manages its own temporary loopback servers and writes redacted evidence/http-evidence.json. It does not require a manually running server or claim to be a Burp run.

## Linux Step 1: Check distribution and install a supported runtime

Check your distribution first:

```bash
cat /etc/os-release
```

The apt commands below target **Ubuntu 24.04 LTS** (default Python 3.12) and **Debian 13/trixie** (default Python 3.13). Their [Ubuntu](https://packages.ubuntu.com/noble/python3) and [Debian](https://packages.debian.org/trixie/python3) package references identify these versions. If Python is missing or its full standard library is needed on those distributions:

```bash
sudo apt update
sudo apt install python3-full
```

Package installation may require your distribution's normal administrative authorization; running the lab does not. No pip installation is required.

**Ubuntu 22.04's default Python 3.10 and Debian 12's default Python 3.11 do not meet this lab's requirement.** Installing their default python3-full does not make them 3.12+. Use a separately installed supported interpreter from your distributor or a supported isolated environment, following [Ubuntu's Python guidance](https://ubuntu.com/developers/docs/howto/python-setup/) or [Python's Unix installation guidance](https://docs.python.org/3/using/unix.html). Other Linux distributions need their own package instructions. Do not replace/remove system Python, rewrite /usr/bin/python3, or add an unverified repository to make these commands work.

## Linux Step 2: Verify the interpreter and SQLite

Use python3 consistently below only after these checks pass. If you intentionally selected a side-by-side executable instead, substitute that same verified executable in **every** Linux command, including extraction and verification:

```bash
python3 --version
python3 -c "import sys, sqlite3; assert sys.version_info >= (3, 12), 'Python 3.12+ required'; c=sqlite3.connect(':memory:'); print('Python', sys.version.split()[0]); print('Executable:', sys.executable); print('SQLite', sqlite3.sqlite_version); print('SQLite query:', c.execute('SELECT 1').fetchone()[0]); c.close()"
```

**Expected result — not a command:** Python 3.12+, the selected executable path, an SQLite version and SQLite query: 1. An older runtime or an SQLite import error must be resolved first.

## Linux Step 3: Extract, enter and check the package

Adjust the download path if needed. Choose a new destination. Python's standard-library ZIP tool does not need a separate unzip package:

```bash
LAB_ZIP="$HOME/Downloads/hunting-idor-lab.zip"
LAB_DIR="$HOME/Downloads/Northline Billing Lab"
if [ ! -f "$LAB_ZIP" ]; then
  printf '%s\n' "ZIP missing: correct LAB_ZIP."
elif [ -e "$LAB_DIR" ]; then
  printf '%s\n' "Choose an unused LAB_DIR."
else
  python3 -m zipfile -e "$LAB_ZIP" "$LAB_DIR" &&
  cd "$LAB_DIR" &&
  ls
fi
```

If the command reported an error, stop; do not launch from the old folder. Confirm the working folder and all six files:

```bash
pwd
ls -l README.md lab/app.py lab/verify.py lab/assets/app.css lab/assets/app.js lab/assets/northline-mark.svg
```

A wrapper directory added by a graphical extraction tool needs one more cd into the actual folder containing README.md and lab/. Do not cd into lab/ itself.

## Linux Step 4: Run both modes and verification

Start one vulnerable server from the checked extracted folder:

```bash
python3 lab/app.py --port 8000
```

Open http://127.0.0.1:8000/ on this computer. The startup line must end in secure=False. Keep the terminal running. To correct it, **Ctrl+C**, wait for the prompt, then run:

```bash
python3 lab/app.py --secure --port 8000
```

The startup line must now end in secure=True. Sign in again after restart and confirm the corrected training badge. Stop with Ctrl+C when finished, then run:

```bash
python3 lab/verify.py
```

The expected result is PASS. If using another terminal, repeat the interpreter checks and cd into the same extracted folder first. The verifier creates redacted evidence/http-evidence.json and stops its own test servers.

## Demo accounts, records and learning guide

| Account | Email | Public demo password | Own invoice | Total |
| --- | --- | --- | --- | --- |
| Alice | alice@northline.test | AliceDemo!2026 | 101 | USD 125.00 |
| Bob | bob@northline.test | BobDemo!2026 | 102 | USD 480.00 |

These are public credentials for fictional local accounts. Password validation uses salted PBKDF2 hashes; login rotates a random server session and Sign out invalidates it. Restarting clears sessions and synthetic in-memory records. There is no registration, reset-password or payment feature.

Explore Dashboard → Invoices → View invoice. Use Sign out or separate private-browser sessions to switch accounts. Alice's invoice has 1 × USD 75.00 and 1 × USD 50.00; Bob's has 2 × USD 150.00 and 3 × USD 60.00. Totals use integer cents. Issue/due dates and Unpaid status are fictional fixture values, not publication dates.

The application name is Northline Billing; the invoice sender is Northline Demo Services. The signed-in account remains outside the invoice. Lists/dashboard summaries are account-scoped in both modes; only vulnerable-mode detail access intentionally allows the cross-account disclosure. Corrected mode checks ownership on both HTML and JSON detail routes. Technical details shows the actual request/status without cookies or passwords.

Open the local **Lab Guide** for the scenario, Burp workflow, collapsed hints and separately revealed solution. Its launcher examples presume py is installed; on a machine without it, use the verified Windows commands in this setup instead. The article's shell examples are Linux commands; Windows uses the verified LabPython executable here. Python verification sends actual local HTTP requests; it does not fabricate Burp evidence.

## Troubleshooting — symptom, cause, fix and confirmation

### WinGet succeeded, but py is missing or python points to the Store

**Symptom:** command not found or a Store message. **Likely cause:** stale terminal environment, omitted launcher, or an App Installer shortcut shadowing the runtime.

1. Completely close/reopen Terminal and PowerShell, then run the two separate version checks and Get-Command from Windows Step 2.
2. Follow only your installation route's PATH/alias recovery in Windows Step 3. If the conditional 3.13 path is absent, locate your real installation instead.
3. Select its exact executable and run the full Windows Step 4 preflight.

**Confirmation:** the selected path exists, the version is 3.12+, and the SQLite query returns 1. WinGet's installed message alone is not this confirmation.

### The command reports an unknown version-selection option

**Symptom:** an interpreter rejects a launcher selector. **Likely cause:** a py-only option was carried over to an interpreter command.

1. Remove the launcher selector when invoking python.exe or LabPython.
2. Use the Windows Step 4 executable selection; do not substitute a launcher option into that path.
3. Run version/SQLite checks before the Windows Step 6 commands.

**Confirmation:** the selected executable accepts --version and the preflight succeeds.

### Python is older than 3.12

**Symptom:** the preflight assertion or app's version guard fails. **Likely cause:** another interpreter is earlier on PATH, or the distribution's default is too old.

1. Inspect the reported executable/version; do not assume the newest installed version was selected.
2. Choose an installed supported runtime explicitly, or follow the correct installation route. On Linux keep the system runtime intact and use a supported side-by-side environment when needed.
3. Repeat the version and SQLite checks using the same executable you will launch.

**Confirmation:** Python 3.12+ is reported and the SQL check passes.

### SQLite cannot be imported or a DLL/_sqlite3 module is missing

**Symptom:** ModuleNotFoundError, ImportError or DLL load failed during the SQLite check. **Likely cause:** incomplete standard library, damaged install, or a different executable than intended.

1. Read sys.executable from the check and confirm that it is the selected runtime.
2. Repair/reinstall that official Windows runtime's standard library. On the supported apt distributions, install/repair python3-full for the matching distro runtime; for a custom Python use its distributor's SQLite build instructions.
3. Repeat the same SQLite connection/SELECT 1 check before launching.

**Confirmation:** the import succeeds and SQLite query: 1 appears. SQLite is a standard-library module; do not try to obtain it with pip.

### Wrong folder, nested extraction or missing files

**Symptom:** cannot open lab/app.py, FileNotFoundError for an asset, or False/missing files in the six-file check. **Likely cause:** ZIP viewer, lab/ as the working directory, an extra wrapper folder, or an incomplete/wrong archive.

1. Inspect Get-Location/Get-ChildItem on Windows or pwd/ls on Linux. Enter the folder that directly contains README.md and lab/.
2. Repeat all six file checks. If files are still absent, download the actual lab ZIP and extract the complete archive into a new folder; do not copy only app.py.
3. Run the matching OS launch command from that root.

**Confirmation:** all six files are present and the server prints its loopback startup address.

### LabPython is unset in a new PowerShell window

**Symptom:** the call operator has no valid executable, or the variable is empty. **Likely cause:** interpreter selection belonged to another session.

1. Repeat Windows Step 4 selection in this window; do not use a stale or guessed path.
2. Run its preflight and Set-Location to the extracted root.
3. Retry the launch/verification command with & $LabPython.

**Confirmation:** the preflight and six-file checks pass in the same window.

### Port 8000 is already occupied

**Symptom:** address already in use / WinError 10048. **Likely cause:** an earlier lab server or another application owns that port.

1. If you recognize your earlier lab terminal, stop it with Ctrl+C and wait for the prompt. Do not blindly terminate processes.
2. If the port belongs to another application, leave it alone and use an unused port. For example, replace --port 8000 with --port 8001 in the same verified interpreter's vulnerable or corrected command.
3. Open http://127.0.0.1:8001/ and use that port consistently in the browser and Burp.

**Confirmation:** the startup line names 8001 and that same address responds. Stop the old lab before switching modes on a shared port.

### Connection refused or the browser cannot connect

**Symptom:** connection refused, timeout or no login page. **Likely cause:** server stopped/crashed, incorrect host/port/protocol, or a different computer/browser environment.

1. Confirm the terminal is still running and read any startup error. Closing the terminal stops the server.
2. Open exactly the printed HTTP loopback address on this computer, not HTTPS and not a VM/host loopback belonging to another machine.
3. Compare with a normal browser without an interception proxy, then correct the matching host/port. Do not tunnel/expose the lab or disable the firewall globally.

**Confirmation:** the normal browser displays the Northline Billing login page at the printed address.

### Burp leaves a page or login request waiting

**Symptom:** the normal browser works but Burp's browser spins, or Repeater never receives a response. **Likely cause:** Intercept is holding a request, a paused request was dropped, or the request targets a different port/host.

1. Inspect Proxy → Intercept. Forward the held request or turn Intercept off for ordinary navigation; capture traffic in HTTP history.
2. Confirm Burp and the browser use the same local HTTP host/port as the server. Keep 127.0.0.1 consistent through login and testing.
3. Reload the login form, sign in again, then resend the baseline request with the current session. Do not publish or tunnel the app to solve proxy routing.

**Confirmation:** the baseline API read returns Alice's invoice 101 under Alice's current session; genuine Repeater evidence must be captured separately.

### Session expired, login fails, or a form cannot be verified

**Symptom:** redirected to login, API 401, or Request not verified. **Likely cause:** restart/expired session, mixed localhost/127.0.0.1 cookies, stale CSRF form or incorrect public demo credentials.

1. Keep the host consistent and reload the login form after a restart.
2. Enter the exact documented email/password with its capitalization. Use Sign out or a separate private session to change account.
3. Sign in again before reusing a saved API request; replace/redact its old cookie appropriately.

**Confirmation:** the header identifies the intended signed-in customer and that customer's own invoice opens.

### Vulnerable and corrected results seem reversed

**Symptom:** cross-account access still works after a supposed fix, or it is denied during the intended vulnerable exercise. **Likely cause:** old process/port, wrong startup flag, different session/account or a different invoice reference.

1. Stop your running lab with Ctrl+C before starting the requested mode on the same port.
2. Use the same verified interpreter and extracted app. Check secure=False/True in the actual startup line and the matching training badge, then sign in again.
3. Confirm Alice owns 101 and Bob owns 102; keep Alice's session when testing 102. Expand Technical details to inspect the actual path/status, without exposing cookies.

**Confirmation:** Alice → 101 works in both modes; Alice → 102 returns Bob's fictional record only in vulnerable mode and a denied/not-found 404 in corrected mode. Run verification to check both modes independently.
