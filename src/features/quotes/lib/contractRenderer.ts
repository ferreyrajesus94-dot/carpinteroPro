export interface ContractVariables {
  client_name: string
  quote_number: string
  total: string
  furniture_name: string
  workshop_name: string
  date: string
}

export function renderContract(template: string, vars: ContractVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in vars ? vars[key as keyof ContractVariables] : match
  })
}
