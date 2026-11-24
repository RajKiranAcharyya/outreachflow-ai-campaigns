import type { Knex } from "knex";

export async function seed(knex: Knex): Promise<void> {
  const existingContacts = await knex("contacts").count("* as count").first();
  if (existingContacts && Number(existingContacts.count) > 0) {
    return;
  }

  const contacts = [
    { email: "alice.smith@example.com", first_name: "Alice", last_name: "Smith", company: "Acme Corp", role: "CTO", note: "Interested in AI", status: "active" },
    { email: "bob.jones@example.com", first_name: "Bob", last_name: "Jones", company: "Beta Inc", role: "VP Engineering", note: "Scaling team", status: "active" },
    { email: "charlie.brown@example.com", first_name: "Charlie", last_name: "Brown", company: "Gamma LLC", role: "Founder", note: "Early stage", status: "active" },
  ];

  const contactIds = await knex("contacts").insert(contacts);

  const [campaignId] = await knex("campaigns").insert({
    name: "Demo Campaign",
    status: "draft",
    daily_limit: 50,
  });

  await knex("campaign_steps").insert([
    {
      campaign_id: campaignId,
      step_number: 1,
      delay_minutes: 0,
      subject_template: "Quick question about {{company}}",
      body_template: "{{ai_opening}} I noticed you are working hard at {{company}}. Would love to connect.",
    },
    {
      campaign_id: campaignId,
      step_number: 2,
      delay_minutes: 1,
      subject_template: "Following up on {{company}}",
      body_template: "Hi {{first_name}}, just bumping this up in case you missed my previous email.",
    },
  ]);
}
