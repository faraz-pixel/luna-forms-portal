-- Rename the dashboard card label for the live Store Purchase form.
update forms
set name = 'Store Purchase'
where slug = 'store-purchase'
  and name = 'Store Purchase Form';
