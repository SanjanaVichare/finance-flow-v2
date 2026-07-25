import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyCompany } from "@/lib/finance.functions";

export function useMyCompany() {
  const fn = useServerFn(getMyCompany);
  return useQuery({
    queryKey: ["my-company"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
}
