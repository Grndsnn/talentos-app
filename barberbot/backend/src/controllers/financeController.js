import { financeService } from '../services/financeService.js';

export const financeController = {
  getDailySummary(req, res) {
    try {
      const { date } = req.query;
      const summary = financeService.getDailySummary(date);
      return res.json({ success: true, data: summary });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
};
