import decimal
import json
import math

from collections import defaultdict

from django.db import connection
from django.http import HttpResponse

from catmaid.models import UserRole, Treenode, BrokenSlice, ClassInstance, \
        ClassInstanceClassInstance
from catmaid.control.authentication import requires_user_role, \
        can_edit_class_instance_or_fail, can_edit_or_fail
from catmaid.control.common import get_relation_to_id_map, \
        get_class_to_id_map, insert_into_log, _create_relation
from catmaid.control.neuron import _delete_if_empty


def can_edit_treenode_or_fail(user, project_id, treenode_id):
    """ Tests if a user has permissions to edit the neuron which the skeleton of
    the treenode models."""
    info = _treenode_info(project_id, treenode_id)
    return can_edit_class_instance_or_fail(user, info['neuron_id'], 'neuron')


@requires_user_role(UserRole.Annotate)
def create_treenode(request, project_id=None):
    """
    Add a new treenode to the database
    ----------------------------------

    1. Add new treenode for a given skeleton id. Parent should not be empty.
       return: new treenode id
       If the parent's skeleton has a single node and belongs to the
       'Isolated synaptic terminals' group, then reassign ownership
       of the skeleton and the neuron to the user. The treenode remains
       property of the original user who created it.

    2. Add new treenode (root) and create a new skeleton (maybe for a given
       neuron) return: new treenode id and skeleton id.

    If a neuron id is given, use that one to create the skeleton as a model of
    it.
    """

    params = {}
    float_values = {
            'x': 0,
            'y': 0,
            'z': 0,
            'radius': 0}
    int_values = {
            'confidence': 0,
            'useneuron': -1,
            'parent_id': -1}
    string_values = {}
    for p in float_values.keys():
        params[p] = float(request.POST.get(p, float_values[p]))
    for p in int_values.keys():
        params[p] = int(request.POST.get(p, int_values[p]))
    for p in string_values.keys():
        params[p] = request.POST.get(p, string_values[p])

    relation_map = get_relation_to_id_map(project_id)
    class_map = get_class_to_id_map(project_id)

    def insert_new_treenode(parent_id=None, skeleton=None):
        """ If the parent_id is not None and the skeleton_id of the parent does
        not match with the skeleton.id, then the database will throw an error
        given that the skeleton_id, being defined as foreign key in the
        treenode table, will not meet the being-foreign requirement.
        """
        new_treenode = Treenode()
        new_treenode.user = request.user
        new_treenode.editor = request.user
        new_treenode.project_id = project_id
        new_treenode.location_x = float(params['x'])
        new_treenode.location_y = float(params['y'])
        new_treenode.location_z = float(params['z'])
        new_treenode.radius = int(params['radius'])
        new_treenode.skeleton = skeleton
        new_treenode.confidence = int(params['confidence'])
        if parent_id:
            new_treenode.parent_id = parent_id
        new_treenode.save()
        return new_treenode

    def relate_neuron_to_skeleton(neuron, skeleton):
        return _create_relation(request.user, project_id,
                                relation_map['model_of'], skeleton, neuron)

    response_on_error = ''
    try:
        if -1 != int(params['parent_id']):  # A root node and parent node exist
            # Raise an Exception if the user doesn't have permission to edit
            # the neuron the skeleton of the treenode is modeling.
            can_edit_treenode_or_fail(request.user, project_id, params['parent_id'])

            parent_treenode = Treenode.objects.get(pk=params['parent_id'])

            response_on_error = 'Could not insert new treenode!'
            skeleton = ClassInstance.objects.get(pk=parent_treenode.skeleton_id)
            new_treenode = insert_new_treenode(params['parent_id'], skeleton)

            return HttpResponse(json.dumps({
                'treenode_id': new_treenode.id,
                'skeleton_id': skeleton.id
            }))
        else:
            # No parent node: We must create a new root node, which needs a
            # skeleton and a neuron to belong to.
            response_on_error = 'Could not insert new treenode instance!'

            new_skeleton = ClassInstance()
            new_skeleton.user = request.user
            new_skeleton.project_id = project_id
            new_skeleton.class_column_id = class_map['skeleton']
            new_skeleton.name = 'skeleton'
            new_skeleton.save()
            new_skeleton.name = 'skeleton %d' % new_skeleton.id
            new_skeleton.save()

            if -1 == params['useneuron']:
                # Check that the neuron to use exists
                if 0 == ClassInstance.objects.filter(pk=params['useneuron']).count():
                    params['useneuron'] = -1

            if -1 != params['useneuron']:
                # Raise an Exception if the user doesn't have permission to
                # edit the existing neuron.
                can_edit_class_instance_or_fail(request.user,
                                                params['useneuron'], 'neuron')

                # A neuron already exists, so we use it
                response_on_error = 'Could not relate the neuron model to ' \
                                    'the new skeleton!'
                relate_neuron_to_skeleton(params['useneuron'], new_skeleton.id)

                response_on_error = 'Could not insert new treenode!'
                new_treenode = insert_new_treenode(None, new_skeleton)

                return HttpResponse(json.dumps({
                    'treenode_id': new_treenode.id,
                    'skeleton_id': new_skeleton.id,
                    'neuron_id': params['useneuron']}))
            else:
                # A neuron does not exist, therefore we put the new skeleton
                # into a new neuron.
                response_on_error = 'Failed to insert new instance of a neuron.'
                new_neuron = ClassInstance()
                new_neuron.user = request.user
                new_neuron.project_id = project_id
                new_neuron.class_column_id = class_map['neuron']
                new_neuron.name = 'neuron'
                new_neuron.save()
                new_neuron.name = 'neuron %d' % new_neuron.id
                new_neuron.save()

                response_on_error = 'Could not relate the neuron model to ' \
                                    'the new skeleton!'
                relate_neuron_to_skeleton(new_neuron.id, new_skeleton.id)

                response_on_error = 'Failed to insert instance of treenode.'
                new_treenode = insert_new_treenode(None, new_skeleton)

                response_on_error = 'Failed to write to logs.'
                new_location = (new_treenode.location_x, new_treenode.location_y,
                                new_treenode.location_z)
                insert_into_log(project_id, request.user.id, 'create_neuron',
                                new_location, 'Create neuron %d and skeleton '
                                '%d' % (new_neuron.id, new_skeleton.id))

                return HttpResponse(json.dumps({
                    'treenode_id': new_treenode.id,
                    'skeleton_id': new_skeleton.id,
                    }))

    except Exception as e:
        import traceback
        raise Exception("%s: %s %s" % (response_on_error, str(e),
                                       str(traceback.format_exc())))


@requires_user_role(UserRole.Annotate)
def create_interpolated_treenode(request, project_id=None):
    params = {}
    decimal_values = {
        'x': 0,
        'y': 0,
        'z': 0,
        'resx': 0,
        'resy': 0,
        'resz': 0,
        'stack_translation_z': 0,
        'radius': -1}
    int_values = {
        'parent_id': 0,
        'stack_id': 0,
        'confidence': 5}
    for p in decimal_values.keys():
        params[p] = decimal.Decimal(request.POST.get(p, decimal_values[p]))
    for p in int_values.keys():
        params[p] = int(request.POST.get(p, int_values[p]))

    last_treenode_id, skeleton_id = _create_interpolated_treenode(request, \
         params, project_id, False)
    return HttpResponse(json.dumps({
        'treenode_id': last_treenode_id,
        'skeleton_id': skeleton_id
    }))


def _create_interpolated_treenode(request, params, project_id, skip_last):
    """ Create interpolated treenodes between the 'parent_id' and the clicked
    x,y,z coordinate. The skip_last is to prevent the creation of the last
    node, used by the join_skeletons_interpolated. """
    response_on_error = 'Could not create interpolated treenode'
    try:
        # Raise an Exception if the user doesn't have permission to edit
        # the neuron the skeleton of the treenode is modeling.
        can_edit_treenode_or_fail(request.user, project_id, params['parent_id'])

        parent = Treenode.objects.get(pk=params['parent_id'])
        parent_skeleton_id = parent.skeleton_id
        parent_x = decimal.Decimal(parent.location_x)
        parent_y = decimal.Decimal(parent.location_y)
        parent_z = decimal.Decimal(parent.location_z)

        steps = abs((params['z'] - parent_z) / params['resz']) \
            .quantize(decimal.Decimal('1'), rounding=decimal.ROUND_FLOOR)
        if steps == decimal.Decimal(0):
            steps = decimal.Decimal(1)

        dx = (params['x'] - parent_x) / steps
        dy = (params['y'] - parent_y) / steps
        dz = (params['z'] - parent_z) / steps

        broken_slices = set(int(bs.index) for bs in \
            BrokenSlice.objects.filter(stack=params['stack_id']))
        sign = -1 if dz < 0 else 1

        # Loop the creation of treenodes in z resolution steps until target
        # section is reached
        parent_id = params['parent_id']
        atn_slice_index = ((parent_z - params['stack_translation_z']) / params['resz']) \
            .quantize(decimal.Decimal('1'), rounding=decimal.ROUND_FLOOR)
        for i in range(1, steps + (0 if skip_last else 1)):
            if (atn_slice_index + i * sign) in broken_slices:
                continue
            response_on_error = 'Error while trying to insert treenode.'
            new_treenode = Treenode()
            new_treenode.user_id = request.user.id
            new_treenode.editor_id = request.user.id
            new_treenode.project_id = project_id
            new_treenode.location_x = float(parent_x + dx * i)
            new_treenode.location_y = float(parent_y + dy * i)
            new_treenode.location_z = float(parent_z + dz * i)
            new_treenode.radius = params['radius']
            new_treenode.skeleton_id = parent_skeleton_id
            new_treenode.confidence = params['confidence']
            new_treenode.parent_id = parent_id  # This is not a root node.
            new_treenode.save()

            parent_id = new_treenode.id

        # parent_id contains the ID of the last added node
        return parent_id, parent_skeleton_id

    except Exception as e:
        raise Exception(response_on_error + ':' + str(e))


@requires_user_role(UserRole.Annotate)
def update_parent(request, project_id=None, treenode_id=None):
    treenode_id = int(treenode_id)
    parent_id = int(request.POST.get('parent_id', -1))

    child = Treenode.objects.get(pk=treenode_id)
    parent = Treenode.objects.get(pk=parent_id)

    if (child.skeleton_id != parent.skeleton_id):
        raise Exception("Child node %s is in skeleton %s but parent node %s is in skeleton %s!", \
                        treenode_id, child.skeleton_id, parent_id, parent.skeleton_id)

    child.parent_id = parent_id
    child.save()

    return HttpResponse(json.dumps({'success': True}))


@requires_user_role(UserRole.Annotate)
def update_radius(request, project_id=None, treenode_id=None):
    treenode_id = int(treenode_id)
    radius = float(request.POST.get('radius', -1))
    if math.isnan(radius):
        raise Exception("Radius '%s' is not a number!" % request.POST.get('radius'))
    option = int(request.POST.get('option', 0))
    cursor = connection.cursor()

    if 0 == option:
        # Update radius only for the treenode
        Treenode.objects.filter(pk=treenode_id).update(editor=request.user,
                                                       radius=radius)
        return HttpResponse(json.dumps({'success': True}))

    cursor.execute('''
    SELECT id, parent_id, radius
    FROM treenode
    WHERE skeleton_id = (SELECT t.skeleton_id FROM treenode t WHERE id = %s)
    ''' % treenode_id)

    if 1 == option:
        # Update radius from treenode_id to next branch or end node (included)
        children = defaultdict(list)
        for row in cursor.fetchall():
            children[row[1]].append(row[0])

        include = [treenode_id]
        c = children[treenode_id]
        while 1 == len(c):
            child = c[0]
            include.append(child)
            c = children[child]

        Treenode.objects.filter(pk__in=include).update(editor=request.user,
                                                       radius=radius)
        return HttpResponse(json.dumps({'success': True}))

    if 2 == option:
        # Update radius from treenode_id to prev branch node or root (excluded)
        parents = {}
        children = defaultdict(list)
        for row in cursor.fetchall():
            parents[row[0]] = row[1]
            children[row[1]].append(row[0])

        include = [treenode_id]
        parent = parents[treenode_id]
        while parent and parents[parent] and 1 == len(children[parent]):
            include.append(parent)
            parent = parents[parent]

        Treenode.objects.filter(pk__in=include).update(editor=request.user,
                                                       radius=radius)
        return HttpResponse(json.dumps({'success': True}))

    if 3 == option:
        # Update radius from treenode_id to prev node with radius (excluded)
        parents = {}
        for row in cursor.fetchall():
            if row[2] < 0 or row[0] == treenode_id: # DB default radius is 0 but is initialized to -1 elsewhere
                parents[row[0]] = row[1]

        include = [treenode_id]
        parent = parents[treenode_id]
        while parent in parents:
            include.append(parent)
            parent = parents[parent]

        Treenode.objects.filter(pk__in=include).update(editor=request.user,
                                                       radius=radius)
        return HttpResponse(json.dumps({'success': True}))

    if 4 == option:
        # Update radius from treenode_id to root (included)
        parents = {row[0]: row[1] for row in cursor.fetchall()}

        include = [treenode_id]
        parent = parents[treenode_id]
        while parent:
            include.append(parent)
            parent = parents[parent]

        Treenode.objects.filter(pk__in=include).update(editor=request.user,
                                                       radius=radius)
        return HttpResponse(json.dumps({'success': True}))

    if 5 == option:
        # Update radius of all nodes (in a single query)
        Treenode.objects \
            .filter(skeleton_id=Treenode.objects \
                .filter(pk=treenode_id) \
                .values('skeleton_id')) \
            .update(editor=request.user, radius=radius)
        return HttpResponse(json.dumps({'success': True}))


# REMARK this function went from 1.6 seconds to 400 ms when de-modelized
@requires_user_role(UserRole.Annotate)
def delete_treenode(request, project_id=None):
    """ Deletes a treenode. If the skeleton has a single node, deletes the
    skeleton and its neuron. Returns the parent_id, if any."""
    treenode_id = int(request.POST.get('treenode_id', -1))
    # Raise an exception if the user doesn't have permission to edit the
    # treenode.
    can_edit_or_fail(request.user, treenode_id, 'treenode')
    # Raise an Exception if the user doesn't have permission to edit the neuron
    # the skeleton of the treenode is modeling.
    can_edit_treenode_or_fail(request.user, project_id, treenode_id)

    treenode = Treenode.objects.get(pk=treenode_id)
    parent_id = treenode.parent_id

    response_on_error = ''
    deleted_neuron = False
    try:
        if not parent_id:
            # This treenode is root.
            response_on_error = 'Could not retrieve children for ' \
                'treenode #%s' % treenode_id
            n_children = Treenode.objects.filter(parent=treenode).count()
            response_on_error = "Could not delete root node"
            if n_children > 0:
                # TODO yes you can, the new root is the first of the children,
                # and other children become independent skeletons
                raise Exception("You can't delete the root node when it "
                                "has children.")
            # Get the neuron before the skeleton is deleted. It can't be
            # accessed otherwise anymore.
            neuron = ClassInstance.objects.get(project_id=project_id,
                        cici_via_b__relation__relation_name='model_of',
                        cici_via_b__class_instance_a=treenode.skeleton)
            # Remove the original skeleton. It is OK to remove it if it only had
            # one node, even if the skeleton's user does not match or the user
            # is not superuser. Delete the skeleton, which triggers deleting
            # the ClassInstanceClassInstance relationship with neuron_id
            response_on_error = 'Could not delete skeleton.'
            # Extra check for errors, like having two root nodes
            count = Treenode.objects.filter(skeleton_id=treenode.skeleton_id) \
                .count()
            if 1 == count:
                # deletes as well treenodes that refer to the skeleton
                ClassInstance.objects.filter(pk=treenode.skeleton_id) \
                    .delete()
            else:
                return HttpResponse(json.dumps({"error": "Can't delete " \
                    "isolated node: erroneously, its skeleton contains more " \
                    "than one treenode! Check for multiple root nodes."}))

            # If the neuron modeled by the skeleton of the treenode is empty,
            # delete it.
            response_on_error = 'Could not delete neuron #%s' % neuron.id
            deleted_neuron = _delete_if_empty(neuron.id)

        else:
            # Treenode is not root, it has a parent and perhaps children.
            # Reconnect all the children to the parent.
            response_on_error = 'Could not update parent id of children nodes'
            Treenode.objects.filter(parent=treenode) \
                .update(parent=treenode.parent)

        # Remove treenode
        response_on_error = 'Could not delete treenode.'
        Treenode.objects.filter(pk=treenode_id).delete()
        return HttpResponse(json.dumps({
            'deleted_neuron': deleted_neuron,
            'parent_id': parent_id,
            'skeleton_id': treenode.skeleton_id,
            'success': "Removed treenode successfully."
        }))

    except Exception as e:
        raise Exception(response_on_error + ': ' + str(e))


def _treenode_info(project_id, treenode_id):
    c = connection.cursor()
    # (use raw SQL since we are returning values from several different models)
    c.execute("""
    SELECT
        treenode.skeleton_id,
        ci.name as skeleton_name,
        ci2.id as neuron_id,
        ci2.name as neuron_name
    FROM
        treenode,
        relation r,
        class_instance ci,
        class_instance ci2,
        class_instance_class_instance cici
    WHERE ci.project_id = %s
      AND treenode.id = %s
      AND treenode.skeleton_id = ci.id
      AND ci.id = cici.class_instance_a
      AND ci2.id = cici.class_instance_b
      AND cici.relation_id = r.id
      AND r.relation_name = 'model_of'
    """, (project_id, treenode_id))
    results = [
        dict(zip([col[0] for col in c.description], row))
        for row in c.fetchall()
    ]
    if (len(results) > 1):
        raise ValueError('Found more than one skeleton and neuron for '
                        'treenode %s' % treenode_id)
    elif (len(results) == 0):
        raise ValueError('No skeleton and neuron for treenode %s' % treenode_id)

    return results[0]


@requires_user_role([UserRole.Annotate, UserRole.Browse])
def treenode_info(request, project_id=None):
    treenode_id = int(request.POST.get('treenode_id', -1))
    if treenode_id < 0:
        raise Exception('A treenode id has not been provided!')

    info = _treenode_info(project_id, treenode_id)
    return HttpResponse(json.dumps(info))
