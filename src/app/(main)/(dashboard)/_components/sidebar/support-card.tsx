import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SupportCard() {
  return (
    <Card
      size="sm"
      className="overflow-hidden border-primary/15 bg-primary/[0.06] shadow-none group-data-[collapsible=icon]:hidden"
    >
      <CardHeader className="min-w-0 gap-1 px-3 py-3">
        <CardTitle className="truncate text-sm">Есть идея?</CardTitle>
        <CardDescription className="line-clamp-3">
          Предложите новую функцию или обсудите индивидуальную доработку.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
