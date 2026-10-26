import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Transactions from '../src/pages/Transactions.jsx';
import { transactionsApi } from '@/api/transactions';
import { categoriesApi } from '@/api/categories';
import toast from 'react-hot-toast';

vi.mock('@/api/transactions', () => ({
  transactionsApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    bulkDelete: vi.fn(),
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

describe('Transactions Page', () => {
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

  it('populates filtered categories and creates a transaction', async () => {
    const mockCategories = [
      { _id: 'cat-groceries', name: 'Groceries', type: 'expense', color: '#ef4444' },
      { _id: 'cat-salary', name: 'Salary', type: 'income', color: '#22c55e' },
    ];
    categoriesApi.list.mockResolvedValue(mockCategories);
    transactionsApi.list.mockResolvedValue({
      data: [],
      pagination: { page: 1, totalPages: 1, total: 0 },
    });
    transactionsApi.create.mockResolvedValue({
      _id: 'tx-1',
      type: 'expense',
      categoryId: 'cat-groceries',
      amount: 45000,
      date: new Date().toISOString(),
      note: 'Supermarket',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Transactions />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Click Add Transaction
    const addBtn = await screen.findByRole('button', { name: /add transaction/i });
    await userEvent.click(addBtn);

    // Verify modal is open
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Default is Expense, so Category select should have Groceries but NOT Salary
    const categorySelect = screen.getByLabelText(/category/i);
    expect(categorySelect).toHaveTextContent('Groceries');
    expect(categorySelect).not.toHaveTextContent('Salary');

    // Switch type to Income
    const typeSelect = screen.getByLabelText(/^type$/i);
    await userEvent.selectOptions(typeSelect, 'income');

    // Now Category select should have Salary and NOT Groceries
    expect(categorySelect).toHaveTextContent('Salary');
    expect(categorySelect).not.toHaveTextContent('Groceries');

    // Switch back to Expense
    await userEvent.selectOptions(typeSelect, 'expense');
    await userEvent.selectOptions(categorySelect, 'cat-groceries');

    // Type Amount
    const amountInput = screen.getByLabelText(/amount/i);
    await userEvent.type(amountInput, '450');

    // Type Note
    const noteInput = screen.getByLabelText(/note/i);
    await userEvent.type(noteInput, 'Supermarket');

    // Submit
    const submitBtn = screen.getByRole('button', { name: 'Create Transaction' });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(transactionsApi.create).toHaveBeenCalled();
    });

    expect(transactionsApi.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        type: 'expense',
        categoryId: 'cat-groceries',
        amount: 45000, // 450 * 100
        note: 'Supermarket',
      })
    );

    expect(toast.success).toHaveBeenCalledWith('Transaction created successfully!');
  });
});
