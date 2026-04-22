-- Allow user account deletion even when they own rooms.
-- Previously rooms.host_id was NO ACTION on delete, which would
-- block auth.users deletion. SET NULL keeps the room row (and its
-- in-progress game) intact while disassociating it from the
-- deleted player.
alter table public.rooms drop constraint rooms_host_id_fkey;
alter table public.rooms
  add constraint rooms_host_id_fkey
  foreign key (host_id) references public.profiles(id) on delete set null;
