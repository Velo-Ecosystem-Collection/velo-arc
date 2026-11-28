import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("ui-redesign-fixture-loaded")) return;
    localStorage.clear();
    localStorage.setItem("theme", "dark");
    localStorage.setItem("ai_panel_open", "false");
    localStorage.setItem("velo-arc-state", JSON.stringify({
      _version: "1.0",
      workspace: {
        treeData: [{
          id: "contract",
          name: "contract",
          type: "folder",
          children: [{ id: "contract/Cargo.toml", name: "Cargo.toml", type: "file", children: [] }],
        }],
        fileContents: { "contract/Cargo.toml": '[package]\nname = "browser-test-contract"\nversion = "0.1.0"\nedition = "2021"\n' },
        expandedFolders: ["contract"],
      },
      sidebar: { width: 400, isCollapsed: false, activePanel: "explorer" },
    }));
    sessionStorage.setItem("ui-redesign-fixture-loaded", "true");
  });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "IDE panels" })).toBeVisible();
});

test("sidebar navigation, keyboard collapse, settings, and theme persist", async ({ page }) => {
  const panelNav = page.getByRole("navigation", { name: "IDE panels" });
  const explorer = panelNav.getByRole("button", { name: "Explorer", exact: true });
  const deploy = panelNav.getByRole("button", { name: "Deploy", exact: true });
  const sidebarPanel = page.locator(".sidebar-panel");

  await deploy.click();
  await expect(deploy).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Build Contract", { exact: true })).toBeVisible();

  await page.keyboard.press("Control+B");
  await expect(sidebarPanel).toHaveClass(/hidden/);
  await explorer.click();
  await expect(sidebarPanel).not.toHaveClass(/hidden/);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Appearance" }).click();
  await page.getByRole("button", { name: "Modern Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: "Close settings" }).click();
  await expect.poll(async () => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("velo-arc-state"));
    return Date.now() - state._lastUpdated;
  })).toBeGreaterThan(60);
  await deploy.click();
  await expect(deploy).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("velo-arc-state")).sidebar.activePanel)).toBe("deploy");
  await page.reload();
  await expect(page.getByRole("navigation", { name: "IDE panels" }).getByRole("button", { name: "Deploy", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("Sonner reports a GitHub clone error", async ({ page }) => {
  await page.getByRole("button", { name: "Create Project" }).click();
  await page.getByText("Clone from GitHub", { exact: true }).click();
  await page.getByRole("textbox", { name: "GitHub repository URL" }).fill("not-a-github-url");
  await page.getByRole("button", { name: "Clone", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();

  const notifications = page.getByRole("region", { name: "Notifications alt+T" });
  await expect(notifications.getByText("Invalid GitHub URL. Please use format: https://github.com/owner/repo", { exact: true })).toBeVisible();
});

test("the Deploy wallet selector connects Noir on Testnet", async ({ page }) => {
  const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  await page.evaluate((address) => {
    window.noir = {
      stellar: {
        isNoir: true,
        requestAccess: async () => ({ address }),
        getNetwork: async () => ({
          networkPassphrase: sessionStorage.getItem("noir-testnet")
            ? "Test SDF Network ; September 2015"
            : "Public Global Stellar Network ; September 2015",
        }),
      },
    };
  }, address);
  await page.route("https://horizon-testnet.stellar.org/accounts/**", (route) =>
    route.fulfill({ json: { balances: [] } }),
  );

  await page.getByRole("navigation", { name: "IDE panels" })
    .getByRole("button", { name: "Deploy", exact: true }).click();
  await page.getByRole("button", { name: "Wallet", exact: true }).click();
  const selector = page.getByRole("combobox", { name: "External wallet" });
  await selector.selectOption({ label: "Noir" });
  const connect = page.getByRole("button", { name: "Connect Noir", exact: true });
  await connect.click();
  await expect(page.getByText("Switch Noir to Testnet, then reconnect.")).toBeVisible();

  await page.evaluate(() => sessionStorage.setItem("noir-testnet", "1"));
  await connect.click();
  await expect(selector).toBeDisabled();
  await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
});
