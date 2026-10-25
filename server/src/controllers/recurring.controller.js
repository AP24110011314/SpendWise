import {
  createRecurringRule,
  listRecurringRules,
  getRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
  processDueRules,
  processRuleNow,
} from '../services/recurring.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function createRecurringRuleController(req, res, next) {
  try {
    const rule = await createRecurringRule(req.userId, req.validated.body);
    res.status(201).json({ data: rule });
  } catch (err) {
    next(err);
  }
}

export async function listRecurringRulesController(req, res, next) {
  try {
    const { activeOnly } = req.validated.query;
    const rules = await listRecurringRules(req.userId, { activeOnly });
    res.json({ data: rules });
  } catch (err) {
    next(err);
  }
}

export async function getRecurringRuleController(req, res, next) {
  try {
    const rule = await getRecurringRule(req.userId, req.validated.params.id);
    res.json({ data: rule });
  } catch (err) {
    next(err);
  }
}

export async function updateRecurringRuleController(req, res, next) {
  try {
    const rule = await updateRecurringRule(req.userId, req.validated.params.id, req.validated.body);
    res.json({ data: rule });
  } catch (err) {
    next(err);
  }
}

export async function deleteRecurringRuleController(req, res, next) {
  try {
    await deleteRecurringRule(req.userId, req.validated.params.id);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
}

export async function processDueRulesController(req, res, next) {
  try {
    const results = await processDueRules(req.userId);
    res.json({ data: results });
  } catch (err) {
    next(err);
  }
}

export async function processRuleNowController(req, res, next) {
  try {
    const results = await processRuleNow(req.userId, req.validated.params.id);
    res.json({ data: results });
  } catch (err) {
    next(err);
  }
}