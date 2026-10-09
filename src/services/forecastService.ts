import { db } from '../db/database';
import type { TransactionItem } from '../types';

export interface ForecastData {
  date: string;
  historicalDemand: number;
  predictedDemand: number;
  isForecast: boolean;
}

export const getProductForecast = async (
  productId: string,
  daysHistory: number = 30,
  daysForecast: number = 7
): Promise<ForecastData[]> => {
  const now = new Date();
  const startDate = new Date(now.getTime() - daysHistory * 24 * 60 * 60 * 1000);
  
  // 1. Fetch historical data
  const historicalItems = await db.transactionItems
    .where('productId')
    .equals(productId)
    .and(item => new Date(item.createdAt) >= startDate)
    .toArray();

  // 2. Aggregate demand by day
  const dailyDemand: Record<string, number> = {};
  
  // Initialize all days in history with 0
  for (let i = 0; i <= daysHistory; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    dailyDemand[dateStr] = 0;
  }

  historicalItems.forEach((item: TransactionItem) => {
    const dateStr = item.createdAt.split('T')[0];
    if (dailyDemand[dateStr] !== undefined) {
      dailyDemand[dateStr] += item.quantity;
    }
  });

  const historyArray: ForecastData[] = Object.entries(dailyDemand).map(([date, demand]) => ({
    date,
    historicalDemand: demand,
    predictedDemand: 0,
    isForecast: false,
  })).sort((a, b) => a.date.localeCompare(b.date));

  // 3. Simple Linear Regression for Forecasting
  // y = mx + b
  const n = historyArray.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  historyArray.forEach((item, index) => {
    const x = index;
    const y = item.historicalDemand;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });

  const denominator = (n * sumX2 - sumX * sumX);
  const m = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const b = (sumY - m * sumX) / n;

  // 4. Generate forecast
  const forecastResults: ForecastData[] = [...historyArray];
  
  for (let i = 1; i <= daysForecast; i++) {
    const forecastDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = forecastDate.toISOString().split('T')[0];
    const x = n + i - 1;
    let predicted = m * x + b;
    
    // Floor to 0 if negative
    predicted = Math.max(0, predicted);

    forecastResults.push({
      date: dateStr,
      historicalDemand: 0,
      predictedDemand: Number(predicted.toFixed(2)),
      isForecast: true,
    });
  }

  return forecastResults;
};

export const getAllProductsDemand = async (daysHistory: number = 30) => {
  const products = await db.inventory.toArray();
  const summary = [];

  for (const product of products) {
    const items = await db.transactionItems.where('productId').equals(product.id).toArray();
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    summary.push({
      id: product.id,
      name: product.banglaName || product.name,
      category: product.category,
      totalQuantity,
    });
  }

  return summary.sort((a, b) => b.totalQuantity - a.totalQuantity);
};
