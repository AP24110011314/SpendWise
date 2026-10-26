import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Recurring from '../src/pages/Recurring.jsx';
import { recurringApi } from '@/api/recurring';
import { categoriesApi } from '@/api/categories';
import toast from 'react-hot-toast';

vi.mock('@/api/recurring', () => ({
  recurringApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    process: vi.fn(),
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

describe('Recurring Page', () => {
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

  it('populates filtered categories and creates a recurring rule', async () => {
    const mockCategories = [
      { _id: 'cat-rent', name: 'Rent', type: 'expense', color: '#ef4444' },
      { _id: 'cat-salary', name: 'Salary', type: 'income', color: '#22c55e' },
    ];
    categoriesApi.list.mockResolvedValue(mockCategories);
    recurringApi.list.mockResolvedValue([]);
    recurringApi.create.mockResolvedValue({
      _id: 'rule-1',
      type: 'expense',
      categoryId: 'cat-rent',
      amount: 2500000,
      frequency: 'monthly',
      anchorDay: 1,
      startDate: '2026-11-01',
      note: 'Apartment Rent',
      active: true,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <Recurring />
      </QueryClientProvider>
    );

    // Click Add Rule
    const addBtn = await screen.findByRole('button', { name: /add rule/i });
    await userEvent.click(addBtn);

    // Verify modal is open
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Default is Expense, so Category select should have Rent but NOT Salary
    const categorySelect = screen.getByLabelText(/category/i);
    expect(categorySelect).toHaveTextContent('Rent');
    expect(categorySelect).not.toHaveTextContent('Salary');

    // Switch type to Income
    const typeSelect = screen.getByLabelText(/^type$/i);
    await userEvent.selectOptions(typeSelect, 'income');

    // Now Category select should have Salary and NOT Rent
    expect(categorySelect).toHaveTextContent('Salary');
    expect(categorySelect).not.toHaveTextContent('Rent');

    // Switch back to Expense
    await userEvent.selectOptions(typeSelect, 'expense');
    await userEvent.selectOptions(categorySelect, 'cat-rent');

    // Type Amount
    const amountInput = screen.getByLabelText(/amount/i);
    await userEvent.type(amountInput, '25000');

    // Type Note
    const noteInput = screen.getByLabelText(/note/i);
    await userEvent.type(noteInput, 'Apartment Rent');

    // Submit
    const submitBtn = screen.getByRole('button', { name: 'Create Rule' });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(recurringApi.create).toHaveBeenCalled();
    });

    expect(recurringApi.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        type: 'expense',
        categoryId: 'cat-rent',
        amount: 2500000, // 25000 * 100
        frequency: 'monthly',
        note: 'Apartment Rent',
      })
    );

    expect(toast.success).toHaveBeenCalledWith('Rule "Apartment Rent" created successfully!');
  });
});
