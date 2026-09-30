import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllCategories,
    getAllGames,
    getAllGameIds,
    getAllPublishers,
    getFilteredGames,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

/** Seeds games across categories and publishers for filter helper tests. */
async function seedFilterGames(
    db: Database,
): Promise<{ strategyId: number; puzzleId: number; publisherTwoId: number }> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'Strategy games' })
        .returning({ id: categories.id });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'Puzzle games' })
        .returning({ id: categories.id });
    const [adventure] = await db
        .insert(categories)
        .values({ name: 'Adventure', description: 'Adventure games' })
        .returning({ id: categories.id });
    const [publisherOne] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'First publisher' })
        .returning({ id: publishers.id });
    const [publisherTwo] = await db
        .insert(publishers)
        .values({ name: 'Pub Two', description: 'Second publisher' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        { title: 'Alpha Strategy', description: 'A strategy game', starRating: 4, categoryId: strategy.id, publisherId: publisherOne.id },
        { title: 'Beta Puzzle', description: 'A puzzle game', starRating: 4, categoryId: puzzle.id, publisherId: publisherOne.id },
        { title: 'Gamma Adventure', description: 'An adventure game', starRating: 4, categoryId: adventure.id, publisherId: publisherTwo.id },
        { title: 'Delta Strategy', description: 'Another strategy game', starRating: 4, categoryId: strategy.id, publisherId: publisherTwo.id },
    ]);

    return { strategyId: strategy.id, puzzleId: puzzle.id, publisherTwoId: publisherTwo.id };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('returns categories and publishers ordered by name', async () => {
        await seedFilterGames(db);

        expect((await getAllCategories(db)).map((category) => category.name)).toEqual([
            'Adventure',
            'Puzzle',
            'Strategy',
        ]);
        expect((await getAllPublishers(db)).map((publisher) => publisher.name)).toEqual([
            'Pub One',
            'Pub Two',
        ]);
    });

    it('filters by any selected category and combines the selection with publisher', async () => {
        const { strategyId, puzzleId, publisherTwoId } = await seedFilterGames(db);

        const games = await getFilteredGames(db, {
            categoryIds: [strategyId, puzzleId],
            publisherId: publisherTwoId,
        });

        expect(games.map((game) => game.title)).toEqual(['Delta Strategy']);
    });

    it('treats an empty category selection as unrestricted', async () => {
        await seedFilterGames(db);

        const games = await getFilteredGames(db, { categoryIds: [] });

        expect(games.map((game) => game.title)).toEqual([
            'Alpha Strategy',
            'Beta Puzzle',
            'Delta Strategy',
            'Gamma Adventure',
        ]);
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
