import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Budgets from '../src/pages/Budgets.jsx';
import { budgetsApi } from '@/api/budgets';
import { categoriesApi } from '@/api/categories';
import toast from 'react-hot-toast';

vi.mock('@/api/budgets', () => ({
  budgetsApi: {
    list: vi.fn(),
    progress: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    copy: vi.fn(),
  },
}));

vi.mock('@/api/categories', () => ({
  categoriesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { _id: 'user-1', name: 'Demo User', currency: 'INR' },
  }),
}));

describe('Budgets Page', () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
  });

  it('populates expense categories in budget modal and creates a budget', async () => {
    const mockCategories = [
      { _id: 'cat-groceries', name: 'Groceries', type: 'expense', color: '#ef4444' },
      { _id: 'cat-salary', name: 'Salary', type: 'income', color: '#22c55e' },
    ];
    categoriesApi.list.mockResolvedValue(mockCategories);
    budgetsApi.list.mockResolvedValue([]);
    budgetsApi.progress.mockResolvedValue({ progress: [], summary: {} });
    budgetsApi.create.mockResolvedValue({
      _id: 'b-1',
      categoryId: 'cat-groceries',
      month: '2026-10',
      limit: 1500000,
      alertThreshold: 80,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <Budgets />
      </QueryClientProvider>
    );

    // Click Add Budget
    const addBtn = await screen.findByRole('button', { name: /add budget/i });
    await userEvent.click(addBtn);

    // Verify modal is open
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Verify category options contains Groceries (expense) and Overall Budget
    const categorySelect = screen.getByLabelText(/category/i);
    expect(categorySelect).toHaveTextContent('Overall Budget');
    expect(categorySelect).toHaveTextContent('Groceries');
    // Salary (income) should NOT be in expense budget options
    expect(categorySelect).not.toHaveTextContent('Salary');

    // Select Groceries
    await userEvent.selectOptions(categorySelect, 'cat-groceries');

    // Type limit
    const limitInput = screen.getByLabelText(/limit/i);
    await userEvent.type(limitInput, '15000');

    // Submit
    const submitBtn = screen.getByRole('button', { name: 'Create Budget' });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(budgetsApi.create).toHaveBeenCalled();
    });

    expect(budgetsApi.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        categoryId: 'cat-groceries',
        limit: 1500000, // 15000 * 100
      })
    );

    expect(toast.success).toHaveBeenCalledWith('Budget created successfully!');
  });
});
