import subprocess
import sys


def run_command(command, description):
    print(f"Running {description}...")
    try:
        result = subprocess.run(command, check=False)
        if result.returncode != 0:
            print(f"❌ {description} failed with exit code {result.returncode}.")
            sys.exit(result.returncode)
        print(f"✅ {description} passed.\n")
    except FileNotFoundError:
        print(f"❌ Command not found: {' '.join(command)}")
        sys.exit(1)


def main():
    print("Running tests...\n")

    checks = [
        (["ruff", "format", "--check", "."], "Ruff Formatter"),
        (["ruff", "check", "."], "Ruff Linter"),
        (["ty", "check", "."], "Ty Type Checker"),
    ]

    for cmd, desc in checks:
        run_command(cmd, desc)

    print("All checks passed successfully! 🎉")


if __name__ == "__main__":
    main()
