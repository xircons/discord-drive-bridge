exports.up = function(knex) {
  return knex.schema.createTable('audit_logs', function(table) {
    table.increments('id').primary();
    table.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('action', 100).notNullable();
    table.string('resource_type', 50);
    table.text('resource_name');
    table.boolean('success').notNullable();
    table.text('error_message');
    table.string('ip_address', 45); // IPv6 max length is 45 characters
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['user_id']);
    table.index(['action']);
    table.index(['success']);
    table.index(['created_at']);
    table.index(['user_id', 'created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('audit_logs');
};
