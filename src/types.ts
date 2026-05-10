import { z } from "zod";

export const HealthResponseSchema = z.object({
	status: z.string(),
	timestamp: z.string(),
	uptime: z.number(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const MarketSchema = z.object({
	name: z.string(),
	netFunding: z.number().nullable().optional(),
	openInterest: z.union([z.number(), z.string()]).nullable().optional(),
	volume: z.union([z.number(), z.string()]).nullable().optional(),
	ratio: z.number().nullable().optional(),
	prevRatio: z.number().nullable().optional(),
	change24h: z.number().nullable().optional(),
	weightedRatio: z.number().nullable().optional(),
	weightedPrevRatio: z.number().nullable().optional(),
	weightedChange24h: z.number().nullable().optional(),
});
export type Market = z.infer<typeof MarketSchema>;

export const MarketsResponseSchema = z.object({
	markets: z.array(MarketSchema),
	total: z.number(),
	page: z.number(),
	pageSize: z.number(),
	totalPages: z.number(),
});
export type MarketsResponse = z.infer<typeof MarketsResponseSchema>;

export const AssetWeightSchema = z.object({
	asset: z.string(),
	weight: z.number(),
});

export const ActiveMarketSchema = z.object({
	key: z.string(),
	longAssets: z.array(AssetWeightSchema),
	shortAssets: z.array(AssetWeightSchema),
	openInterest: z.union([z.number(), z.string()]).nullable().optional(),
	volume: z.union([z.number(), z.string()]).nullable().optional(),
	netFunding: z.union([z.number(), z.string()]).nullable().optional(),
	ratio: z.union([z.number(), z.string()]).nullable().optional(),
	prevRatio: z.union([z.number(), z.string()]).nullable().optional(),
	change24h: z.union([z.number(), z.string()]).nullable().optional(),
	weightedRatio: z.union([z.number(), z.string()]).nullable().optional(),
	weightedPrevRatio: z.union([z.number(), z.string()]).nullable().optional(),
	weightedChange24h: z.union([z.number(), z.string()]).nullable().optional(),
});
export type ActiveMarket = z.infer<typeof ActiveMarketSchema>;

export const ActiveMarketsResponseSchema = z.object({
	active: z.array(ActiveMarketSchema),
	topGainers: z.array(ActiveMarketSchema).optional(),
	topLosers: z.array(ActiveMarketSchema).optional(),
	highlighted: z.array(ActiveMarketSchema).optional(),
	watchlist: z.array(ActiveMarketSchema).optional(),
});
export type ActiveMarketsResponse = z.infer<typeof ActiveMarketsResponseSchema>;

export const AccountSummarySchema = z.object({
	agentWalletAddress: z.string(),
	totalClosedTrades: z.number(),
	totalTriggerOrderUsdValue: z.number().optional(),
	totalTwapChunkUsdValue: z.number().optional(),
	lastSyncedAt: z.coerce.number().optional(),
});
export type AccountSummary = z.infer<typeof AccountSummarySchema>;

export const PositionSchema = z
	.object({
		positionId: z.string(),
		entryRatio: z.number().nullable().optional(),
		markRatio: z.number().nullable().optional(),
		unrealizedPnl: z.number().nullable().optional(),
		longAssets: z.array(z.unknown()).optional(),
		shortAssets: z.array(z.unknown()).optional(),
	})
	.passthrough();
export type Position = z.infer<typeof PositionSchema>;

export const PositionsResponseSchema = z.array(PositionSchema);

export const OpenOrderSchema = z
	.object({
		orderId: z.string(),
		address: z.string().optional(),
		orderType: z.string().optional(),
		status: z.string().optional(),
		longAssets: z.array(z.unknown()).optional(),
		shortAssets: z.array(z.unknown()).optional(),
	})
	.passthrough();
export const OpenOrdersResponseSchema = z.array(OpenOrderSchema);

export const TwapOrderSchema = z
	.object({
		orderId: z.string(),
	})
	.passthrough();
export const TwapOrdersResponseSchema = z.array(TwapOrderSchema);

export const TradeHistoryItemSchema = z
	.object({
		tradeHistoryId: z.string(),
		positionId: z.string().optional(),
		address: z.string().optional(),
		realizedPnl: z.number().nullable().optional(),
		realizedPnlPercentage: z.number().nullable().optional(),
		totalValue: z.number().nullable().optional(),
		totalEntryValue: z.number().nullable().optional(),
		entryRatio: z.number().nullable().optional(),
		exitRatio: z.number().nullable().optional(),
		createdAt: z.union([z.string(), z.number()]).optional(),
	})
	.passthrough();
export const TradeHistoryResponseSchema = z.array(TradeHistoryItemSchema);

export const PortfolioBucketSchema = z
	.object({
		volumeUsd: z.number().optional(),
		openInterest: z.number().optional(),
		winningTrades: z.number().optional(),
		losingTrades: z.number().optional(),
		winningAmount: z.number().optional(),
		losingAmount: z.number().optional(),
	})
	.passthrough();

export const PortfolioResponseSchema = z
	.object({
		oneDay: PortfolioBucketSchema.optional(),
		oneWeek: PortfolioBucketSchema.optional(),
		oneMonth: PortfolioBucketSchema.optional(),
		oneYear: PortfolioBucketSchema.optional(),
		all: PortfolioBucketSchema.optional(),
		overall: z
			.object({
				totalWinningTrades: z.number().optional(),
				totalLosingTrades: z.number().optional(),
				openInterest: z.number().optional(),
				allTimeVolume: z.number().optional(),
				unrealizedPnl: z.number().optional(),
				totalTradeCount: z.number().optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough();
export type PortfolioResponse = z.infer<typeof PortfolioResponseSchema>;
