import { test, expect, type Response } from '@playwright/test';

test.describe('Game Listing and Navigation', () => {
  test('should display games with titles on index page', async ({ page }) => {
    await test.step('Navigate to homepage', async () => {
      await page.goto('/');
    });

    await test.step('Verify games grid is visible', async () => {
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Verify game cards are displayed', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first()).toBeVisible();
      expect(await gameCards.count()).toBeGreaterThan(0);
    });

    await test.step('Verify game cards have titles with content', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first().getByTestId('game-title')).toBeVisible();
      await expect(gameCards.first().getByTestId('game-title')).not.toBeEmpty();
    });
  });

  test('should display each game rating out of five on the index page', async ({ page }) => {
    await page.goto('/');

    const gameCards = page.getByTestId('game-card');
    const ratings = page.getByTestId('game-rating');
    await expect(gameCards.first()).toBeVisible();
    await expect(ratings).toHaveCount(await gameCards.count());
    for (const rating of await ratings.all()) {
      await expect(rating).toContainText(/(?:No rating yet|\d\.\d \/ 5)$/);
    }
  });

  test('should filter games by multiple categories and publisher and clear the filters', async ({ page }) => {
    await page.goto('/');

    const gameCards = page.getByTestId('game-card');
    const categoryFilters = page.getByTestId('category-filter');
    const publisherFilter = page.getByTestId('publisher-filter');
    const resultsCount = page.getByTestId('filter-results-count');
    const initialCount = await gameCards.count();
    const selectedCategoryIds = [
      await categoryFilters.nth(0).getAttribute('value'),
      await categoryFilters.nth(1).getAttribute('value'),
    ];

    await test.step('Select multiple categories and verify they combine as alternatives', async () => {
      await categoryFilters.nth(0).check();
      await categoryFilters.nth(1).check();

      const expectedCount = await gameCards.evaluateAll((cards, categoryIds) =>
        cards.filter((card) => categoryIds.includes(card.getAttribute('data-game-category-id') ?? '')).length,
      selectedCategoryIds);
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(expectedCount);
      await expect(resultsCount).toHaveText(`Showing ${expectedCount} of ${initialCount} games`);
    });

    await test.step('Combine the category selection with a publisher filter', async () => {
      await publisherFilter.selectOption({ index: 1 });

      const publisherId = await publisherFilter.inputValue();
      const expectedCount = await gameCards.evaluateAll((cards, filters) =>
        cards.filter((card) =>
          filters.categoryIds.includes(card.getAttribute('data-game-category-id') ?? '') &&
          card.getAttribute('data-game-publisher-id') === filters.publisherId,
        ).length,
      { categoryIds: selectedCategoryIds, publisherId });
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(expectedCount);
      await expect(resultsCount).toHaveText(
        expectedCount === 0 ? 'No games match the selected filters.' : `Showing ${expectedCount} of ${initialCount} games`,
      );
    });

    await test.step('Clear all filters and restore every game card', async () => {
      await page.getByTestId('clear-game-filters').click();
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(initialCount);
      await expect(resultsCount).toHaveText(`Showing ${initialCount} of ${initialCount} games`);
    });
  });

  test('should expose accessible filter controls with keyboard operation and visible focus', async ({ page }) => {
    await page.goto('/');

    const filters = page.getByRole('region', { name: 'Filter games' });
    const categories = filters.getByRole('group', { name: 'Categories' });
    const actionCategory = categories.getByRole('checkbox', { name: 'Action' });
    const publisher = filters.getByRole('combobox', { name: 'Publisher' });
    const clearButton = filters.getByRole('button', { name: 'Clear filters' });
    const resultStatus = page.getByRole('status');

    await expect(categories).toBeVisible();
    await expect(actionCategory).toHaveAttribute('data-testid', 'category-filter');
    await expect(publisher).toHaveAttribute('data-testid', 'publisher-filter');
    await expect(clearButton).toHaveAttribute('data-testid', 'clear-game-filters');
    await expect(resultStatus).toHaveAttribute('aria-live', 'polite');

    await test.step('Use the category checkbox from the keyboard and verify focus visibility', async () => {
      await actionCategory.focus();
      await expect(actionCategory).toBeFocused();
      await expect
        .poll(() => actionCategory.evaluate((input) => getComputedStyle(input).boxShadow))
        .not.toBe('none');

      await actionCategory.press('Space');

      await expect(actionCategory).toBeChecked();
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(5);
      await expect(resultStatus).toHaveText('Showing 5 of 21 games');
    });
  });

  test('should navigate to correct game details page when clicking on a game', async ({ page }) => {
    let gameId: string | null;
    let gameTitle: string | null;

    await test.step('Navigate to homepage and wait for games to load', async () => {
      await page.goto('/');
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Get first game information and click it', async () => {
      const firstGameCard = page.getByTestId('game-card').first();
      gameId = await firstGameCard.getAttribute('data-game-id');
      gameTitle = await firstGameCard.getAttribute('data-game-title');
      await firstGameCard.click();
    });

    await test.step('Verify navigation to game details page', async () => {
      await expect(page).toHaveURL(`/game/${gameId}`);
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title matches clicked game', async () => {
      if (gameTitle) {
        await expect(page.getByTestId('game-details-title')).toHaveText(gameTitle);
      }
    });
  });

  test('should display game details with all required information', async ({ page }) => {
    await test.step('Navigate to specific game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title is displayed', async () => {
      const gameTitle = page.getByTestId('game-details-title');
      await expect(gameTitle).toBeVisible();
      await expect(gameTitle).not.toBeEmpty();
    });

    await test.step('Verify game description is displayed', async () => {
      const gameDescription = page.getByTestId('game-details-description');
      await expect(gameDescription).toBeVisible();
      await expect(gameDescription).not.toBeEmpty();
    });

    await test.step('Verify publisher or category information is present', async () => {
      const publisherExists = await page.getByTestId('game-details-publisher').isVisible();
      const categoryExists = await page.getByTestId('game-details-category').isVisible();
      expect(publisherExists || categoryExists).toBeTruthy();

      if (publisherExists) {
        await expect(page.getByTestId('game-details-publisher')).not.toBeEmpty();
      }

      if (categoryExists) {
        await expect(page.getByTestId('game-details-category')).not.toBeEmpty();
      }
    });
  });

  test('should display a button to back the game', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify back game button is visible and enabled', async () => {
      const backButton = page.getByTestId('back-game-button');
      await expect(backButton).toBeVisible();
      await expect(backButton).toContainText('Support This Game');
      await expect(backButton).toBeEnabled();
    });
  });

  test('should be able to navigate back to home from game details', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Click back to all games link', async () => {
      const backLink = page.getByRole('link', { name: /back to all games/i });
      await expect(backLink).toBeVisible();
      await backLink.click();
    });

    await test.step('Verify navigation back to homepage', async () => {
      await expect(page).toHaveURL('/');
      await expect(page.getByTestId('games-grid')).toBeVisible();
    });
  });

  test('should return a 404 page for a non-existent game', async ({ page }) => {
    let response: Response | null;

    await test.step('Navigate to non-existent game', async () => {
      response = await page.goto('/game/99999');
    });

    await test.step('Verify a branded 404 page is served', async () => {
      expect(response?.status()).toBe(404);
      await expect(page).toHaveTitle(/Page Not Found - Tailspin Toys/);
      await expect(page.getByTestId('not-found')).toBeVisible();
      await expect(page.getByTestId('not-found-heading')).not.toBeEmpty();
      await expect(page.getByTestId('not-found-home-link')).toBeVisible();
    });
  });
});
