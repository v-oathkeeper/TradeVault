'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { HouseholdCapitalSummary, OwnerCapitalSummary } from '@/types/capital';
import { useUser } from '@/components/providers/UserContext';
import { useMemo } from 'react';

export function useCapitalData(initialSummary?: HouseholdCapitalSummary) {
  const queryClient = useQueryClient();
  const { householdId, selectedPersonId, persons } = useUser();

  const queryKey = useMemo(() => ['capital-summary', householdId], [householdId]);

  const { data: summary, refetch, isFetching } = useQuery<HouseholdCapitalSummary>({
    queryKey,
    queryFn: async () => {
      const res = await fetch('/api/capital/summary');
      if (!res.ok) throw new Error('Failed to fetch capital summary');
      const data = await res.json();
      return data.summary;
    },
    initialData: initialSummary,
    staleTime: 60 * 1000,
  });

  const husbandPerson = useMemo(
    () =>
      persons.find(
        (p) =>
          p.relationshipLabel.toLowerCase().includes('husband') ||
          p.displayName.toLowerCase().includes('husband') ||
          p.relationshipLabel.toLowerCase().includes('self')
      ) || persons[0],
    [persons]
  );

  const wifePerson = useMemo(
    () =>
      persons.find(
        (p) =>
          p.relationshipLabel.toLowerCase().includes('wife') ||
          p.displayName.toLowerCase().includes('wife') ||
          p.relationshipLabel.toLowerCase().includes('spouse')
      ) || persons[1],
    [persons]
  );

  const husbandSummary: OwnerCapitalSummary | undefined = useMemo(() => {
    if (!summary) return undefined;
    if (husbandPerson) {
      return summary.owners.find((o) => o.portfolioOwnerId === husbandPerson.id);
    }
    return summary.owners[0];
  }, [summary, husbandPerson]);

  const wifeSummary: OwnerCapitalSummary | undefined = useMemo(() => {
    if (!summary) return undefined;
    if (wifePerson) {
      return summary.owners.find((o) => o.portfolioOwnerId === wifePerson.id);
    }
    return summary.owners[1];
  }, [summary, wifePerson]);

  // Selected view data: Combined, Husband, or Wife
  const currentViewData = useMemo(() => {
    if (!summary) {
      return {
        view: selectedPersonId,
        investedCapital: 0,
        availableProfit: 0,
        allTimeProfit: 0,
        initialCapital: 0,
        additionalCapital: 0,
        profitWithdrawn: 0,
        capitalWithdrawn: 0,
      };
    }

    if (selectedPersonId === 'combined') {
      return {
        view: 'combined',
        investedCapital: summary.combinedInvestedCapital,
        availableProfit: summary.combinedAvailableProfit,
        allTimeProfit: summary.combinedAllTimeProfit,
        initialCapital: (husbandSummary?.initialCapital ?? 0) + (wifeSummary?.initialCapital ?? 0),
        additionalCapital: (husbandSummary?.additionalCapital ?? 0) + (wifeSummary?.additionalCapital ?? 0),
        profitWithdrawn: (husbandSummary?.profitWithdrawn ?? 0) + (wifeSummary?.profitWithdrawn ?? 0),
        capitalWithdrawn: (husbandSummary?.capitalWithdrawn ?? 0) + (wifeSummary?.capitalWithdrawn ?? 0),
      };
    }

    const matched = summary.owners.find((o) => o.portfolioOwnerId === selectedPersonId);
    return {
      view: selectedPersonId,
      investedCapital: matched?.investedCapital ?? 0,
      availableProfit: matched?.availableProfit ?? 0,
      allTimeProfit: matched?.allTimeProfit ?? 0,
      initialCapital: matched?.initialCapital ?? 0,
      additionalCapital: matched?.additionalCapital ?? 0,
      profitWithdrawn: matched?.profitWithdrawn ?? 0,
      capitalWithdrawn: matched?.capitalWithdrawn ?? 0,
    };
  }, [summary, selectedPersonId, husbandSummary, wifeSummary]);

  const invalidateCapitalCache = () => {
    queryClient.invalidateQueries({ queryKey: ['capital-summary'] });
    queryClient.invalidateQueries({ queryKey: ['capital-transactions'] });
  };

  return {
    summary,
    husbandSummary,
    wifeSummary,
    currentViewData,
    refetch,
    isFetching,
    invalidateCapitalCache,
  };
}
