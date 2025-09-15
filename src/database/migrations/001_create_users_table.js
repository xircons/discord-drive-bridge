exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.bigInteger('id').primary().comment('Discord user ID');
    table.string('google_email', 255).unique().notNullable();
    table.text('encrypted_refresh_token').notNullable();
    table.text('encrypted_access_token').notNullable();
    table.timestamp('token_expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.boolean('is_active').defaultTo(true);
    
    table.index(['google_email']);
    table.index(['is_active']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('users');
};
